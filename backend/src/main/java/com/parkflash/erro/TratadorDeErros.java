package com.parkflash.erro;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class TratadorDeErros {

    @ExceptionHandler(NaoEncontradoException.class)
    ResponseEntity<ErroApi> naoEncontrado(NaoEncontradoException e) {
        return resposta(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(ConflitoException.class)
    ResponseEntity<ErroApi> conflito(ConflitoException e) {
        return resposta(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(RegraInvalidaException.class)
    ResponseEntity<ErroApi> regraInvalida(RegraInvalidaException e) {
        return resposta(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErroApi> validacao(MethodArgumentNotValidException e) {
        Map<String, String> campos = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(erro -> campos.putIfAbsent(erro.getField(), erro.getDefaultMessage()));
        String primeiro = campos.entrySet().stream().findFirst()
                .map(c -> c.getKey() + ": " + c.getValue())
                .orElse("Dados inválidos.");
        return ResponseEntity.badRequest().body(new ErroApi(400, "Dados inválidos — " + primeiro, campos));
    }

    @ExceptionHandler({HandlerMethodValidationException.class, MethodArgumentTypeMismatchException.class,
            ServletRequestBindingException.class})
    ResponseEntity<ErroApi> parametrosInvalidos(Exception e) {
        return resposta(HttpStatus.BAD_REQUEST, "Parâmetros da requisição inválidos.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ErroApi> statusHttp(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(new ErroApi(e.getStatusCode().value(), e.getReason()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErroApi> comprovanteGrande(MaxUploadSizeExceededException e) {
        return resposta(HttpStatus.PAYLOAD_TOO_LARGE, "Anexe um comprovante em PDF de até 2 MB.");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErroApi> jsonInvalido(HttpMessageNotReadableException e) {
        return resposta(HttpStatus.BAD_REQUEST, "Corpo da requisição inválido.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErroApi> integridade(DataIntegrityViolationException e) {
        return resposta(HttpStatus.CONFLICT, "Operação viola um vínculo ou registro já existente.");
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ErroApi> naoAutenticado(AuthenticationException e) {
        return resposta(HttpStatus.UNAUTHORIZED, e.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErroApi> acessoNegado(AccessDeniedException e) {
        return resposta(HttpStatus.FORBIDDEN, "Seu nível de acesso não permite esta operação.");
    }

    private ResponseEntity<ErroApi> resposta(HttpStatus status, String mensagem) {
        return ResponseEntity.status(status).body(new ErroApi(status.value(), mensagem));
    }
}
