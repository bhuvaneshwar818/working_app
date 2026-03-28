package com.securechat.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "otp_log")
@Data
public class OTPLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String identifier; // Mobile or Email
    private String otpCode;
    private String channel; // SMS or EMAIL
    private String status; // SENT, FAILED, PENDING
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}
