package com.securechat.backend.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Getter
@Setter
@Table(name = "dark_room_rooms")
public class DarkRoomRoom {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    private User initiator;

    @ManyToOne(fetch = FetchType.LAZY)
    private User receiver;

    private String hashedInitiatorPin;
    private String hashedReceiverPin;
    
    // Statuses: PENDING (waiting for receiver), ACCEPTED (receiver keyed in, waiting for initiator), READY (both keyed in)
    private String status;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
