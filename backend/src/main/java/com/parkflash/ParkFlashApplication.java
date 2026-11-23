package com.parkflash;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ParkFlashApplication {

    public static void main(String[] args) {
        SpringApplication.run(ParkFlashApplication.class, args);
    }
}
