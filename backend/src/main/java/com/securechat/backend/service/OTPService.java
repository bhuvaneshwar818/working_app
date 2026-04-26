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
                sendResendEmail(identifier, "SecureChat Verification Code", 
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
        sendResendEmail(to, subject, body);
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

    private void sendResendEmail(String to, String subject, String body) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + System.getenv("RESEND_API_KEY"));

            Map<String, Object> payload = new HashMap<>();
            payload.put("from", "noreply@thedarkroom.in");
            payload.put("to", to);
            payload.put("subject", subject);
            payload.put("html", "<html><body><p>" + body.replace("\n", "<br>") + "</p></body></html>");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            restTemplate.postForEntity("https://api.resend.com/emails", entity, String.class);
            System.out.println("✅ Real OTP successfully sent via Resend API to: " + to);
        } catch (Exception e) {
            System.err.println("❌ Failed to physically send email via Resend. Msg: " + e.getMessage());
        }
    }
}
