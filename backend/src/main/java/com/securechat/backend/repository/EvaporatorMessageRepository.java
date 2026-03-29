package com.securechat.backend.repository;

import com.securechat.backend.enums.MessageStatus;
import com.securechat.backend.models.EvaporatorMessage;
import com.securechat.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface EvaporatorMessageRepository extends JpaRepository<EvaporatorMessage, UUID> {
    List<EvaporatorMessage> findByRecipientAndSenderOrderByCreatedAtAsc(User recipient, User sender);
    List<EvaporatorMessage> findByRecipientAndStatus(User recipient, MessageStatus status);
    
    // Total cleanup query for evaporation logic
    void deleteByRecipientAndSenderAndStatus(User recipient, User sender, MessageStatus status);

    @Query("SELECT COUNT(DISTINCT e.sender) FROM EvaporatorMessage e WHERE e.recipient = :recipient")
    long countDistinctSendersByRecipient(@Param("recipient") User recipient);

    @Query("SELECT e.sender.username, COUNT(e) FROM EvaporatorMessage e WHERE e.recipient = :recipient GROUP BY e.sender.username")
    List<Object[]> countMessagesPerSenderForRecipient(@Param("recipient") User recipient);
}
