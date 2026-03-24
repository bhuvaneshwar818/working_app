package com.securechat.backend.controller;

import com.securechat.backend.dto.AuthRequest;
import com.securechat.backend.dto.AuthResponse;
import com.securechat.backend.dto.RegisterRequest;
import com.securechat.backend.repository.UserRepository;
import com.securechat.backend.service.OTPService;
import com.securechat.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

import com.securechat.backend.security.JwtUtil;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final OTPService otpService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        System.out.println("======= REACHED REGISTER CONTROLLER! =======");
        try {
            return ResponseEntity.ok(authService.register(request));
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/validate-email")
    public ResponseEntity<?> validateEmailInternal(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null || !email.matches("^[A-Za-z0-9+_.-]+@(.+)$")) {
            return ResponseEntity.badRequest().body("Internal Validation Failed: Invalid Email Sandbox Syntax.");
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body("Internal Validation Failed: Email is already securely registered.");
        }

        // Real-world Domain Check (Checking if the domain physically exists and can receive emails via MX Record DNS)
        try {
            String domain = email.substring(email.indexOf("@") + 1);
            java.util.Hashtable<String, String> env = new java.util.Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            javax.naming.directory.DirContext ictx = new javax.naming.directory.InitialDirContext(env);
            javax.naming.directory.Attributes attrs = ictx.getAttributes(domain, new String[]{"MX"});
            javax.naming.directory.Attribute attr = attrs.get("MX");
            if (attr == null || attr.size() == 0) {
                return ResponseEntity.badRequest().body("Real World Validation Failed: That email domain has no mail servers.");
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Real World Validation Failed: That email domain does not physically exist in DNS.");
        }
        
        return ResponseEntity.ok(Map.of("status", "valid", "message", "Email internal structure and real-world domain algorithmically verified."));
    }

    @PostMapping("/send-signup-otp")
    public ResponseEntity<?> sendSignupOtp(@RequestBody Map<String, String> request) {
        String identifier = request.get("identifier");
        if (identifier == null || identifier.isEmpty()) {
            return ResponseEntity.badRequest().body("Identifier required");
        }
        String type = request.getOrDefault("type", "email").equalsIgnoreCase("phone") ? "SMS" : "EMAIL";
        otpService.generateAndSendOTP(identifier, type);
        return ResponseEntity.ok("Verification OTP dispatched via " + type);
    }

    @PostMapping("/verify-signup-otp")
    public ResponseEntity<?> verifySignupOtp(@RequestBody Map<String, String> request) {
        String identifier = request.get("identifier");
        String otp = request.get("otp");
        if (otpService.verifyOTP(identifier, otp)) {
            return ResponseEntity.ok("Valid code! Mathematical identity mathematically confirmed.");
        }
        return ResponseEntity.badRequest().body("Invalid Verification Code.");
    }

    @PostMapping("/forgot-username")
    public ResponseEntity<?> forgotUsername(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String phone = request.get("phone");
        String dob = request.get("dob");
        com.securechat.backend.models.User user = userRepository.findByEmail(email).orElse(null);
        if (user != null && user.getMobileNumber() != null && user.getDob() != null && 
            user.getMobileNumber().equals(phone) && user.getDob().equals(dob)) {
            String body = "SecureChat Gateway Architecture\n\nWe received a recovery request for your identity.\n\nYour Unique Official Username is: " + user.getUsername() + "\n\nIf you did not request this, please secure your account immediately.";
            otpService.sendGenericEmail(email, "SecureChat Identity Recovery", body);
        }
        // Always return generic OK to strictly prevent active scraping of registered emails
        return ResponseEntity.ok("If your details match, your Username has been physically dispatched to your inbox.");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String usernameOrPhone = request.get("usernameOrPhone");
        
        com.securechat.backend.models.User user = userRepository.findByEmail(email).orElse(null);
        if (user != null && ((user.getUsername() != null && user.getUsername().equals(usernameOrPhone)) || 
                             (user.getMobileNumber() != null && user.getMobileNumber().equals(usernameOrPhone)))) {
            otpService.generateAndSendOTP(email);
            return ResponseEntity.ok("OTP Sent to " + email);
        }
        return ResponseEntity.badRequest().body("Details do not match any entity.");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String otp = request.get("otp");
        String newPassword = request.get("newPassword");
        
        if (!otpService.verifyOTP(email, otp)) {
             return ResponseEntity.badRequest().body("Invalid or expired OTP");
        }
        
        com.securechat.backend.models.User user = userRepository.findByEmail(email).orElseThrow();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        otpService.clearOTP(email);
        
        return ResponseEntity.ok("Password successfully reset. You may now login.");
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> request) {
         String idToken = request.get("token");
         if (idToken == null || idToken.isEmpty()) {
              return ResponseEntity.badRequest().body("Missing Google ID Token");
         }
         
         try {
             org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
             String googleUri = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
             ResponseEntity<Map> googleResponse = restTemplate.getForEntity(googleUri, Map.class);
             
             if (!googleResponse.getStatusCode().is2xxSuccessful() || googleResponse.getBody() == null) {
                 return ResponseEntity.status(401).body("Invalid Google Token");
             }
             
             Map<String, Object> payload = googleResponse.getBody();
             String email = (String) payload.get("email");
             String name = (String) payload.get("name");
             
             if (email == null) return ResponseEntity.badRequest().body("Email required from Google");
             
             java.util.Optional<com.securechat.backend.models.User> optUser = userRepository.findByEmail(email);
             
             if (optUser.isPresent()) {
                 String token = jwtUtil.generateToken(optUser.get().getUsername());
                 return ResponseEntity.ok(AuthResponse.builder().token(token).username(optUser.get().getUsername()).build());
             } else {
                 Map<String, Object> response = new java.util.HashMap<>();
                 response.put("requiresSetup", true);
                 response.put("email", email);
                 response.put("firstName", name != null ? name.split(" ")[0] : "");
                 response.put("lastName", name != null && name.split(" ").length > 1 ? name.split(" ")[1] : "");
                 return ResponseEntity.ok(response);
             }
         } catch (Exception e) {
             return ResponseEntity.status(401).body("Google Authentication Verification Failed: " + e.getMessage());
         }
    }

    @PostMapping("/google-register")
    public ResponseEntity<?> googleRegister(@RequestBody Map<String, String> request) {
         String idToken = request.get("token");
         String username = request.get("username");
         String password = request.get("password");

         if (idToken == null || username == null || password == null) {
              return ResponseEntity.badRequest().body("Missing payload data");
         }
         
         if (userRepository.existsByUsername(username)) {
              return ResponseEntity.badRequest().body("Username is already taken");
         }

         try {
             org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
             String googleUri = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
             ResponseEntity<Map> googleResponse = restTemplate.getForEntity(googleUri, Map.class);
             
             if (!googleResponse.getStatusCode().is2xxSuccessful() || googleResponse.getBody() == null) {
                 return ResponseEntity.status(401).body("Invalid Google Token");
             }
             
             Map<String, Object> payload = googleResponse.getBody();
             String email = (String) payload.get("email");
             String name = (String) payload.get("name");
             
             if (userRepository.existsByEmail(email)) {
                  return ResponseEntity.badRequest().body("Email already structurally bound.");
             }

             com.securechat.backend.models.User newUser = new com.securechat.backend.models.User();
             newUser.setEmail(email);
             newUser.setUsername(username); 
             newUser.setPassword(passwordEncoder.encode(password));
             newUser.setFirstName(name != null ? name : username);
             userRepository.save(newUser);

             String token = jwtUtil.generateToken(newUser.getUsername());
             return ResponseEntity.ok(AuthResponse.builder().token(token).username(newUser.getUsername()).build());
         } catch (Exception e) {
             return ResponseEntity.status(401).body("Google Registration Failed: " + e.getMessage());
         }
    }
}
