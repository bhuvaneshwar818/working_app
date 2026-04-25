package com.securechat.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import com.securechat.backend.models.OTPLog;
import com.securechat.backend.repository.OTPLogRepository;

import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OTPService {
    private final Map<String, String> otps = new ConcurrentHashMap<>();

    @Autowired
    private OTPLogRepository otpLogRepository;

    public void generateAndSendOTP(String identifier, String channel) {
        String otp = String.format("%06d", (int) (Math.random() * 1000000));
        otps.put(identifier, otp);

        System.out.println("==================================================");
        System.out.println("🔐 DISPATCHING OTP via " + channel);
        System.out.println("To: " + identifier);
        System.out.println("Code: " + otp);
        System.out.println("==================================================");

        String status = "SENT";

        if (channel.equalsIgnoreCase("EMAIL")) {
            try {
                sendBrevoEmail(identifier, "SecureChat Verification Code", 
                    "Welcome to SecureChat Architecture.\n\nYour highly secure 6-Digit Verification OTP is: " + otp
                    + "\n\nDo not share this securely generated code with anyone.");
            } catch (Exception e) {
                status = "FAILED";
            }
        }

        // Save to Database Log
        try {
            OTPLog log = new OTPLog();
            log.setIdentifier(identifier);
            log.setOtpCode(otp);
            log.setChannel(channel);
            log.setStatus(status);
            otpLogRepository.save(log);
            System.out.println("📝 OTP Log recorded in database for " + identifier + " with status: " + status);
        } catch (Exception e) {
            System.err.println("❌ FAILED to log OTP to database: " + e.getMessage());
        }
    }

    public void sendGenericEmail(String to, String subject, String body) {
        sendBrevoEmail(to, subject, body);
    }

    public void generateAndSendOTP(String email) {
        generateAndSendOTP(email, "EMAIL");
    }

    public boolean verifyOTP(String email, String otp) {
        if ("123456".equals(otp)) return true; // MAGIC CODE FOR TESTING
        String stored = otps.get(email);
        return stored != null && stored.equals(otp);
    }

    public void clearOTP(String email) {
        otps.remove(email);
    }

    private void sendBrevoEmail(String to, String subject, String body) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "application/json");
            headers.set("api-key", System.getenv("BREVO_API_KEY"));

            Map<String, Object> sender = new HashMap<>();
            sender.put("name", "SecureChat");
            sender.put("email", "mbhuvaneshwarmbhuvaneshwar379@gmail.com");

            Map<String, Object> recipient = new HashMap<>();
            recipient.put("email", to);
            recipient.put("name", "SecureChat User");

            Map<String, Object> payload = new HashMap<>();
            payload.put("sender", sender);
            payload.put("to", java.util.Arrays.asList(recipient));
            payload.put("subject", subject);
            payload.put("htmlContent", "<html><body><p>" + body.replace("\n", "<br>") + "</p></body></html>");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            restTemplate.postForEntity("https://api.brevo.com/v3/smtp/email", entity, String.class);
            System.out.println("✅ Real OTP successfully sent via Brevo API to: " + to);
        } catch (Exception e) {
            System.err.println("❌ Failed to physically send email via Brevo. Msg: " + e.getMessage());
        }
    }
}
