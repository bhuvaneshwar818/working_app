package com.securechat.backend.repository;

import com.securechat.backend.enums.RequestStatus;
import com.securechat.backend.models.ChatRequest;
import com.securechat.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatRequestRepository extends JpaRepository<ChatRequest, UUID> {
    List<ChatRequest> findByReceiverAndStatus(User receiver, RequestStatus status);
    List<ChatRequest> findBySenderAndStatus(User sender, RequestStatus status);
    
    @Query("SELECT cr FROM ChatRequest cr WHERE (cr.sender = :user1 AND cr.receiver = :user2) OR (cr.sender = :user2 AND cr.receiver = :user1)")
    Optional<ChatRequest> findRequestBetweenUsers(@Param("user1") User user1, @Param("user2") User user2);
}
