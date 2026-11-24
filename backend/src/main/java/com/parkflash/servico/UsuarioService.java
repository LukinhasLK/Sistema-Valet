package com.parkflash.servico;

import com.parkflash.dominio.NivelAcesso;
import com.parkflash.dominio.Usuario;
import com.parkflash.erro.ConflitoException;
import com.parkflash.erro.NaoEncontradoException;
import com.parkflash.erro.RegraInvalidaException;
import com.parkflash.repositorio.UnidadeRepository;
import com.parkflash.repositorio.UsuarioRepository;
import com.parkflash.web.dto.UsuarioRequest;
import com.parkflash.web.dto.UsuarioResponse;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final UnidadeRepository unidades;
    private final JdbcClient jdbc;
    private final AuditoriaAdministrativa auditoria;

    public UsuarioService(UsuarioRepository usuarios, PasswordEncoder encoder, UnidadeRepository unidades, JdbcClient jdbc,
                          AuditoriaAdministrativa auditoria) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.unidades = unidades;
        this.jdbc = jdbc;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<UsuarioResponse> listar(boolean incluirInativos) {
        return usuarios.findAll(Sort.by("id")).stream().filter(usuario -> incluirInativos || usuario.isAtivo()).map(UsuarioResponse::de).toList();
    }

    @Transactional
    public UsuarioResponse criar(UsuarioRequest pedido, Long atorId) {
        String email = pedido.email().trim().toLowerCase();
        if (usuarios.existsByEmailIgnoreCase(email)) {
            throw new ConflitoException("Já existe um usuário com esse e-mail.");
        }
        if (vazia(pedido.senha())) {
            throw new RegraInvalidaException("Informe uma senha para o novo usuário.");
        }
        Usuario usuario = new Usuario();
        preencher(usuario, pedido, email);
        usuarios.saveAndFlush(usuario);
        auditar(atorId, usuario.getId(), "CRIAR");
        auditarPermissoes(atorId, usuario, null, null, true);
        return UsuarioResponse.de(usuario);
    }

    /** Senha vazia na edição mantém a senha atual. */
    @Transactional
    public UsuarioResponse atualizar(Long id, UsuarioRequest pedido, Long usuarioLogadoId) {
        Usuario usuario = buscar(id);
        String email = pedido.email().trim().toLowerCase();
        if (usuarios.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw new ConflitoException("Já existe um usuário com esse e-mail.");
        }
        if (id.equals(usuarioLogadoId) && pedido.nivel() != NivelAcesso.PROPRIETARIO) {
            throw new RegraInvalidaException("Você não pode remover o seu próprio nível de Proprietário.");
        }
        var nivel = usuario.getNivel().getRotulo();
        var escopo = escopo(usuario);
        preencher(usuario, pedido, email);
        auditarPermissoes(usuarioLogadoId, usuario, nivel, escopo, false);
        if (!vazia(pedido.senha())) {
            auditoria.registrar(AuditoriaAdministrativa.Tipo.USUARIO, id, usuarioLogadoId,
                    "Senha", null, "Redefinida pela administração");
        }
        auditar(usuarioLogadoId, id, vazia(pedido.senha()) ? "ATUALIZAR" : "REDEFINIR_SENHA");
        return UsuarioResponse.de(usuario);
    }

    @Transactional
    public void excluir(Long id, Long usuarioLogadoId) {
        if (id.equals(usuarioLogadoId)) {
            throw new RegraInvalidaException("Você não pode excluir o próprio usuário.");
        }
        Usuario usuario = buscar(id);
        // Libera o sócio para um login novo (o vínculo é único).
        usuario.setSocioId(null);
        usuario.desativar();
        auditoria.registrar(AuditoriaAdministrativa.Tipo.USUARIO, id, usuarioLogadoId,
                "Situação", "Ativo", "Desativado");
        auditar(usuarioLogadoId, id, "DESATIVAR");
    }

    private Usuario buscar(Long id) {
        return usuarios.bloquear(id).flatMap(usuarios::findById).filter(Usuario::isAtivo).orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
    }

    private void preencher(Usuario usuario, UsuarioRequest pedido, String email) {
        usuario.setNome(pedido.nome().trim());
        usuario.setEmail(email);
        usuario.setNivel(pedido.nivel());
        usuario.setSocioId(socioDoLogin(pedido, usuario.getId()));
        // Proprietário vê tudo; o sócio vê as unidades onde tem participação (vêm do rateio, não daqui).
        Set<Long> escopo = pedido.nivel() == NivelAcesso.PROPRIETARIO || pedido.nivel() == NivelAcesso.SOCIO
                ? Set.of()
                : Objects.requireNonNullElse(pedido.unidadeIds(), usuario.getUnidadeIds());
        if (unidades.countByIdIn(escopo) != escopo.size()) {
            throw new RegraInvalidaException("Uma das unidades autorizadas não existe.");
        }
        usuario.definirUnidades(escopo);
        if (!vazia(pedido.senha())) {
            usuario.setSenhaHash(encoder.encode(pedido.senha()));
        }
    }

    private Long socioDoLogin(UsuarioRequest pedido, Long usuarioId) {
        if (pedido.nivel() != NivelAcesso.SOCIO) return null;
        if (pedido.socioId() == null) throw new RegraInvalidaException("Escolha qual sócio este login representa.");
        boolean existe = jdbc.sql("SELECT EXISTS(SELECT 1 FROM socio WHERE id = :id)").param("id", pedido.socioId())
                .query(Boolean.class).single();
        if (!existe) throw new RegraInvalidaException("Sócio não encontrado.");
        boolean emUso = jdbc.sql("SELECT EXISTS(SELECT 1 FROM usuario WHERE socio_id = :socio AND id <> :id)")
                .param("socio", pedido.socioId()).param("id", usuarioId == null ? -1L : usuarioId)
                .query(Boolean.class).single();
        if (emUso) throw new ConflitoException("Este sócio já tem um login. Edite o usuário existente.");
        return pedido.socioId();
    }

    private void auditarPermissoes(long ator, Usuario usuario, String nivelAnterior, String escopoAnterior, boolean criacao) {
        var tipo = AuditoriaAdministrativa.Tipo.USUARIO;
        auditoria.registrar(tipo, usuario.getId(), ator, "Perfil", nivelAnterior, usuario.getNivel().getRotulo());
        auditoria.registrar(tipo, usuario.getId(), ator, "Unidades (IDs)", escopoAnterior, escopo(usuario));
        if (criacao) auditoria.registrar(tipo, usuario.getId(), ator, "Situação", null, "Ativo");
    }

    private static String escopo(Usuario usuario) {
        if (usuario.getNivel() == NivelAcesso.PROPRIETARIO) return "Todas";
        if (usuario.getNivel() == NivelAcesso.SOCIO) return "Sócio #" + usuario.getSocioId();
        if (usuario.getUnidadeIds().isEmpty()) return "Nenhuma";
        return usuario.getUnidadeIds().stream().sorted().map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private void auditar(Long ator, Long usuario, String acao) {
        jdbc.sql("INSERT INTO auditoria_usuario (ator_id, usuario_id, acao) VALUES (:ator, :usuario, :acao)")
                .param("ator", ator).param("usuario", usuario).param("acao", acao).update();
    }

    private static boolean vazia(String senha) {
        return senha == null || senha.isBlank();
    }
}
