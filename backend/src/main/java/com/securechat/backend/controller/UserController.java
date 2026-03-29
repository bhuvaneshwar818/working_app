package com.securechat.backend.controller;

import com.securechat.backend.models.User;
import com.securechat.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final com.securechat.backend.service.OnlineStatusService onlineService;

    @GetMapping("/search")
    public ResponseEntity<List<com.securechat.backend.dto.UserPublicProfileDto>> searchUsers(@RequestParam String q, java.security.Principal principal) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        
        String myName = principal != null ? principal.getName() : "";
        
        List<com.securechat.backend.dto.UserPublicProfileDto> matches = userRepository.findAll().stream()
                .filter(u -> u.getUsername().toLowerCase().contains(q.toLowerCase()) && !u.getUsername().equals(myName))
                .limit(10)
                .map(u -> com.securechat.backend.dto.UserPublicProfileDto.builder()
                    .username(u.getUsername())
                    .profilePicture(u.isProfilePhotoPublic() ? u.getProfilePicture() : null)
                    .allowIncomingRequests(u.isAllowIncomingRequests())
                    .trustBreakCount(u.getTrustBreakCount())
                    .successfulConnectionsCount(u.getSuccessfulConnectionsCount())
                    .build())
                .collect(Collectors.toList());
                 
        return ResponseEntity.ok(matches);
    }

    @GetMapping("/{username}/public")
    public ResponseEntity<com.securechat.backend.dto.UserPublicProfileDto> getPublicProfile(@PathVariable String username) {
        return userRepository.findByUsername(username).map(u -> {
            com.securechat.backend.dto.UserPublicProfileDto dto = com.securechat.backend.dto.UserPublicProfileDto.builder()
                .username(u.getUsername())
                .profilePicture(u.isProfilePhotoPublic() ? u.getProfilePicture() : null)
                .allowIncomingRequests(u.isAllowIncomingRequests())
                .trustBreakCount(u.getTrustBreakCount())
                .successfulConnectionsCount(u.getSuccessfulConnectionsCount())
                .build();
            return ResponseEntity.ok(dto);
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/online")
    public ResponseEntity<java.util.Set<String>> getOnlineUsers() {
        return ResponseEntity.ok(onlineService.getOnlineUsers());
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<?> pingHeartbeat(java.security.Principal principal) {
        if (principal != null) onlineService.heartbeat(principal.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/profile")
    public ResponseEntity<com.securechat.backend.dto.UserProfileDto> getProfile(java.security.Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return ResponseEntity.ok(com.securechat.backend.dto.UserProfileDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .gender(user.getGender())
                .dob(user.getDob())
                .email(user.getEmail())
                .mobileNumber(user.getMobileNumber())
                .profilePicture(user.getProfilePicture())
                .profilePhotoPublic(user.isProfilePhotoPublic())
                .allowIncomingRequests(user.isAllowIncomingRequests())
                .trustBreakCount(user.getTrustBreakCount())
                .successfulConnectionsCount(user.getSuccessfulConnectionsCount())
                .build());
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(java.security.Principal principal, @RequestBody Map<String, Object> updates) {
        if (principal == null) return ResponseEntity.status(401).build();
        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (updates.containsKey("firstName")) user.setFirstName((String) updates.get("firstName"));
        if (updates.containsKey("lastName")) user.setLastName((String) updates.get("lastName"));
        if (updates.containsKey("email")) user.setEmail((String) updates.get("email"));
        if (updates.containsKey("mobileNumber")) user.setMobileNumber((String) updates.get("mobileNumber"));
        if (updates.containsKey("gender")) user.setGender((String) updates.get("gender"));
        if (updates.containsKey("dob") && updates.get("dob") != null) {
            user.setDob((String) updates.get("dob"));
        }
        if (updates.containsKey("profilePicture")) {
            user.setProfilePicture((String) updates.get("profilePicture"));
        }
        if (updates.containsKey("isProfilePhotoPublic")) {
            user.setProfilePhotoPublic((Boolean) updates.get("isProfilePhotoPublic"));
        }
        if (updates.containsKey("allowIncomingRequests")) {
            user.setAllowIncomingRequests((Boolean) updates.get("allowIncomingRequests"));
        }

        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Profile successfully updated"));
    }

    @PutMapping("/password")
    public ResponseEntity<?> updatePassword(java.security.Principal principal, 
            @org.springframework.beans.factory.annotation.Autowired org.springframework.security.crypto.password.PasswordEncoder encoder, 
            @RequestBody Map<String, String> request) {
        if (principal == null) return ResponseEntity.status(401).build();
        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String currentPass = request.get("currentPassword");
        String newPass = request.get("newPassword");

        if (currentPass == null || newPass == null || !encoder.matches(currentPass, user.getPassword())) {
             return ResponseEntity.badRequest().body("Cryptographic verification failed: Incorrect current password.");
        }

        user.setPassword(encoder.encode(newPass));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Password securely updated"));
    }
}
