package com.securechat.backend.repository;

import com.securechat.backend.models.DarkRoomMessage;
import com.securechat.backend.models.DarkRoomRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DarkRoomMessageRepository extends JpaRepository<DarkRoomMessage, UUID> {
    List<DarkRoomMessage> findByDarkRoomOrderByCreatedAtAsc(DarkRoomRoom darkRoom);
    void deleteByDarkRoom(DarkRoomRoom darkRoom);
}
