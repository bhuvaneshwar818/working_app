package com.securechat.backend.service;

import com.securechat.backend.dto.AuthRequest;
import com.securechat.backend.dto.AuthResponse;
import com.securechat.backend.dto.RegisterRequest;
import com.securechat.backend.models.User;
import com.securechat.backend.repository.UserRepository;
import com.securechat.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final OTPService otpService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    public AuthResponse register(RegisterRequest request) {
        if (!otpService.verifyOTP(request.getEmail(), request.getOtp())) {
            throw new RuntimeException("Registration Failed: Email OTP Verification was invalid or expired.");
        }
        
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username is already taken");
        }
        if (request.getEmail() != null && userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email is already registered");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setGender(request.getGender());
        user.setDob(request.getDob());
        user.setEmail(request.getEmail());
        user.setMobileNumber(request.getMobileNumber());

        userRepository.save(user);
        otpService.clearOTP(request.getEmail());
        otpService.clearOTP(request.getMobileNumber());

        String jwtToken = jwtUtil.generateToken(user.getUsername());
        return AuthResponse.builder()
                .token(jwtToken)
                .username(user.getUsername())
                .build();
    }

    public AuthResponse login(AuthRequest request) {
        if (!userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("User not found. Please create an account.");
        }
        
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            throw new RuntimeException("Invalid password.");
        }

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String jwtToken = jwtUtil.generateToken(user.getUsername());
        return AuthResponse.builder()
                .token(jwtToken)
                .username(user.getUsername())
                .build();
    }
}
