package com.securechat.backend.config;

import com.securechat.backend.service.DarkRoomService;
import com.securechat.backend.service.OnlineStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final DarkRoomService darkRoomService;
    private final SimpMessagingTemplate messagingTemplate;
    private final OnlineStatusService onlineStatusService;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String username = null;
        if (event.getUser() != null) {
            username = event.getUser().getName();
        } else if (headerAccessor.getSessionAttributes() != null && headerAccessor.getSessionAttributes().containsKey("username")) {
            username = (String) headerAccessor.getSessionAttributes().get("username");
        }
        
        if (username != null) {
             onlineStatusService.userConnected(username);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        
        String username = null;
        if (headerAccessor.getUser() != null) {
            username = headerAccessor.getUser().getName();
        } else if (headerAccessor.getSessionAttributes() != null && headerAccessor.getSessionAttributes().containsKey("username")) {
            username = (String) headerAccessor.getSessionAttributes().get("username");
        }
        
        if (username != null) {
            onlineStatusService.userDisconnected(username);
            darkRoomService.wipeUserAttemptByUsername(username);
        }
    }
}
