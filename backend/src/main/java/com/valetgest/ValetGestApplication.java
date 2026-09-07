package com.valetgest;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Classe principal - é por aqui que a aplicação inicia.
 *
 * A anotação @SpringBootApplication faz três coisas ao mesmo tempo:
 * - @Configuration: marca a classe como fonte de configuração
 * - @EnableAutoConfiguration: o Spring configura tudo automaticamente
 * - @ComponentScan: o Spring procura componentes (@Service, @Controller, etc)
 */
@SpringBootApplication
public class ValetGestApplication {

    public static void main(String[] args) {
        SpringApplication.run(ValetGestApplication.class, args);
    }
}
