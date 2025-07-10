"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../../lib/socket";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const router = useRouter();

  useEffect(() => {
    // 초기 로드
    fetch("http://localhost:4000/rooms")
      .then(res => res.json())
      .then(setRooms)
      .catch(err => console.error("방 목록 불러오기 실패:", err));

    // socket.io 실시간 갱신
    socket.on("rooms-updated", (updatedRooms) => {
      setRooms(updatedRooms);
    });

    return () => {
      socket.off("rooms-updated");
    };
  }, []);

  const createRoom = () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    router.push(`/room/${roomId}`);
  };

  return (
    <div>
      <h2>방 게시판 (실시간)</h2>
      <button onClick={createRoom}>방 만들기</button>
      <ul>
        {rooms.map(room => (
          <li key={room.id}>
            <a href={`/room/${room.id}`}>
              방 ID: {room.id} (참여자: {room.count})
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
