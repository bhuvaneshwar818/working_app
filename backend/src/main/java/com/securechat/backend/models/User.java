package com.securechat.backend.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Getter
@Setter
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    private String firstName;
    private String lastName;
    private String gender;
    private String dob;
    
    @Column(unique = true)
    private String email;
    
    private String mobileNumber;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String profilePicture;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean isProfilePhotoPublic = true;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean allowIncomingRequests = true;

    // Trust tracking
    @Column(nullable = false, columnDefinition = "int default 0")
    private int trustBreakCount = 0;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int successfulConnectionsCount = 0;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
