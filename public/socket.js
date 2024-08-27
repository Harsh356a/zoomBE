let peerConnection;
const socket = io();

socket.emit('joinRoom', roomId);

socket.on('notify_new_joining', () => {
    makeAnOffer();
});

async function makeAnOffer() {
    console.log("Sending offer");
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('makeOffer', offer, roomId);
    } catch (error) {
        console.error("Error creating offer:", error);
    }
}

socket.on("receiveOffer", async (offer) => {
    console.log("Received offer");
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer, roomId);
    } catch (error) {
        console.error("Error handling offer:", error);
    }
});

socket.on("answer", async (answer) => {
    console.log("Received answer");
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error("Error setting remote description:", error);
    }
});

function addTrackToWebRTC() {
    mediaStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, mediaStream);
    });
}

function makeAWebRTCConnection() {
    peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ]
    });

    peerConnection.addEventListener('icecandidate', handleCandidate);
    peerConnection.addEventListener('track', handleTrack);

    addTrackToWebRTC();
}

function handleCandidate(event) {
    if (event.candidate) {
        socket.emit('ice', event.candidate, roomId);
    }
}

function handleTrack(event) {
    console.log("Received remote track", event);
    const video = document.createElement('video');
    video.srcObject = event.streams[0];
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.error("Error playing video:", e));
    });
    videoGrid.appendChild(video);
}

socket.on("ice", async (candidate) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error("Error adding ICE candidate:", error);
    }
});

// Initialize WebRTC connection
makeAWebRTCConnection();