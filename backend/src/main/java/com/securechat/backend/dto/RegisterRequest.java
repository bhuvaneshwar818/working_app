package com.securechat.backend.dto;

import lombok.Data;

@Data
public class RegisterRequest {
    private String username;
    private String password;
    
    private String firstName;
    private String lastName;
    private String gender;
    private String dob;
    private String email;
    private String mobileNumber;
    private String otp;
}
