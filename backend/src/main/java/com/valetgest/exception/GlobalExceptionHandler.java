package com.valetgest.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Captura exceções de toda a aplicação e devolve respostas padronizadas.
 *
 * Sem isso, qualquer erro vira um stack trace feio na resposta.
 * Com isso, a API devolve um JSON limpo com a mensagem de erro.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NegocioException.class)
    public ResponseEntity<Map<String, Object>> handleNegocio(NegocioException ex) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(criarResposta(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    /**
     * Quando @Valid encontra erros nos DTOs, esse método captura
     * e devolve uma lista organizada dos campos com problema.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidacao(
            MethodArgumentNotValidException ex) {

        Map<String, String> erros = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                erros.put(error.getField(), error.getDefaultMessage())
        );

        Map<String, Object> resposta = criarResposta(
                HttpStatus.BAD_REQUEST,
                "Erro de validação"
        );
        resposta.put("erros", erros);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resposta);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeral(Exception ex) {
        ex.printStackTrace();
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(criarResposta(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Erro inesperado: " + ex.getMessage()));
    }

    private Map<String, Object> criarResposta(HttpStatus status, String mensagem) {
        Map<String, Object> resposta = new HashMap<>();
        resposta.put("timestamp", LocalDateTime.now());
        resposta.put("status", status.value());
        resposta.put("mensagem", mensagem);
        return resposta;
    }
}
