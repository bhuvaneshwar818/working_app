package com.securechat.backend.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

@Component
public class EncryptionUtil {

    private final String secretKey;

    public EncryptionUtil(@Value("${app.encryption.key:my-super-secret-key-16-bytes}") String secretKey) {
        // Simple padding for demo, in production use 16, 24, or 32 byte keys
        this.secretKey = padKey(secretKey);
    }

    private String padKey(String key) {
        if (key.length() < 16) {
            return (key + "0000000000000000").substring(0, 16);
        }
        return key.substring(0, 16);
    }

    public String encrypt(String strToEncrypt) {
        if (strToEncrypt == null) return null;
        try {
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(), "AES");
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec);
            return Base64.getEncoder().encodeToString(cipher.doFinal(strToEncrypt.getBytes()));
        } catch (Exception e) {
            System.err.println("Encryption error: " + e.getMessage());
            return strToEncrypt; 
        }
    }

    public String decrypt(String strToDecrypt) {
        if (strToDecrypt == null) return null;
        try {
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(), "AES");
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, secretKeySpec);
            return new String(cipher.doFinal(Base64.getDecoder().decode(strToDecrypt)));
        } catch (Exception e) {
            // If it's not encrypted, it might be plain text from old records
            return strToDecrypt;
        }
    }
}
