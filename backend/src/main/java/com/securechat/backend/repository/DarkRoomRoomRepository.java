package com.securechat.backend.repository;

import com.securechat.backend.models.DarkRoomRoom;
import com.securechat.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DarkRoomRoomRepository extends JpaRepository<DarkRoomRoom, UUID> {
    @Query("SELECT dr FROM DarkRoomRoom dr WHERE dr.initiator = :user OR dr.receiver = :user")
    List<DarkRoomRoom> findAllByUser(@Param("user") User user);
    
    @Query("SELECT dr FROM DarkRoomRoom dr WHERE (dr.initiator = :u1 AND dr.receiver = :u2) OR (dr.initiator = :u2 AND dr.receiver = :u1)")
    Optional<DarkRoomRoom> findBetweenUsers(@Param("u1") User u1, @Param("u2") User u2);
}
