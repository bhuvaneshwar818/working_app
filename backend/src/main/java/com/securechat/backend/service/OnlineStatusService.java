package com.securechat.backend.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OnlineStatusService {
    private final Map<String, Long> lastSeen = new ConcurrentHashMap<>();
    private final Set<String> activeWebSockets = ConcurrentHashMap.newKeySet();

    public void userConnected(String username) {
        if (username != null) activeWebSockets.add(username);
    }

    public void userDisconnected(String username) {
        if (username != null) activeWebSockets.remove(username);
    }
    
    public void heartbeat(String username) {
        if (username != null) lastSeen.put(username, System.currentTimeMillis());
    }

    public Set<String> getOnlineUsers() {
        long threshold = System.currentTimeMillis() - 15000; // 15 seconds threshold
        Set<String> online = lastSeen.entrySet().stream()
                .filter(e -> e.getValue() > threshold)
                .map(java.util.Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toSet());
        online.addAll(activeWebSockets);
        return online;
    }
}
