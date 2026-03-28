package com.securechat.backend.repository;

import com.securechat.backend.models.OTPLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OTPLogRepository extends JpaRepository<OTPLog, Long> {
}
