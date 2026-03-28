package com.securechat.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.beans.factory.annotation.Autowired;
import com.securechat.backend.models.OTPLog;
import com.securechat.backend.repository.OTPLogRepository;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OTPService {
    // Storing OTPs in memory for dev.
    private final Map<String, String> otps = new ConcurrentHashMap<>();

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private OTPLogRepository otpLogRepository;

    public void generateAndSendOTP(String identifier, String channel) {
        String otp = String.format("%06d", (int) (Math.random() * 1000000));
        otps.put(identifier, otp);

        System.out.println("==================================================");
        System.out.println("🔐 DISPATCHING OTP via " + channel);
        System.out.println("To: " + identifier);
        System.out.println("Code: " + otp);
        if (mailSender == null) {
            System.err.println("⚠️ JavaMailSender is NULL! Email will not be sent physically.");
        }
        System.out.println("==================================================");

        String status = "SENT";

        if (channel.equalsIgnoreCase("EMAIL")) {
            if (mailSender != null) {
                try {
                    SimpleMailMessage message = new SimpleMailMessage();
                    message.setTo(identifier);
                    message.setSubject("SecureChat Verification Code");
                    message.setText(
                            "Welcome to SecureChat Architecture.\n\nYour highly secure 6-Digit Verification OTP is: " + otp
                                    + "\n\nDo not share this securely generated code with anyone.");
                    mailSender.send(message);
                    System.out.println("✅ Physical Email successfully dispatched to " + identifier);
                } catch (Exception e) {
                    status = "FAILED";
                    System.err.println("❌ FAILED to physically send email. Msg: " + e.getMessage());
                    e.printStackTrace();
                }
            } else {
                status = "FAILED_NO_MAILER";
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
        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(to);
                message.setSubject(subject);
                message.setText(body);
                mailSender.send(message);
            } catch (Exception e) {
                System.err.println("❌ Failed to physically send generic email.");
            }
        }
    }

    public void generateAndSendOTP(String email) {
        generateAndSendOTP(email, "EMAIL");
    }

    public boolean verifyOTP(String email, String otp) {
        String stored = otps.get(email);
        return stored != null && stored.equals(otp);
    }

    public void clearOTP(String email) {
        otps.remove(email);
    }
}
