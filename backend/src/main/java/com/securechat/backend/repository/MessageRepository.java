package com.securechat.backend.repository;

import com.securechat.backend.models.Message;
import com.securechat.backend.models.ChatRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, UUID> {
    List<Message> findByChatRequestOrderByCreatedAtAsc(ChatRequest chatRequest);
    @Query("SELECT m FROM Message m WHERE m.chatRequest.id = :chatRequestId ORDER BY m.createdAt ASC")
    List<Message> findByChatRequestIdOrderByCreatedAtAsc(@Param("chatRequestId") UUID chatRequestId);
    List<Message> findByChatRequestReceiverUsernameAndStatus(String receiverUsername, com.securechat.backend.enums.MessageStatus status);
    long countByChatRequestIdAndSenderUsernameNotAndStatusNot(UUID chatRequestId, String username, com.securechat.backend.enums.MessageStatus status);
}
