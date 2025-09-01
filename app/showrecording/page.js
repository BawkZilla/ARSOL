"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from '@/lib/supabaseClient';

export default function ShowRecording() {
    const [videos, setVideos] = useState([]);           
    const router = useRouter();

    function formatDate(name) {
        try {
            const raw = name.split("_")[0];           
            const y = raw.slice(0, 4);
            const m = raw.slice(4, 6);
            const d = raw.slice(6, 8);
            const h = raw.slice(9,11);
            const t = raw.slice(11,13);
            return `${y}년 ${m}월 ${d}일 ${h}시 ${t}분`;
        } catch {
            return name;                              // 예상 형식이 아니면 그대로
        }
    }

    useEffect(() => {
        const nickname = localStorage.getItem("nickname"); 
        if (!nickname) return;

        async function fetchVideos() {
        
        const { data, error } = await supabase.storage
            .from("recordings")
            .list(nickname, {
            limit: 100,
            sortBy: { column: "name", order: "desc" },
            });

        if (error) {
            console.error("영상 목록 불러오기 실패:", error.message);
            return;
        }

        // 각 파일에 대한 public URL 생성
        const items = await Promise.all(
            data.map(async (file) => {
            const { data: urlData } = supabase.storage
                .from("recordings")
                .getPublicUrl(`${nickname}/${file.name}`);
            return { name: file.name, url: urlData.publicUrl };
            })
        );

        setVideos(items);
        }

        fetchVideos();
    }, []);

    const left = () => {
        router.push('/rooms')
    };



    return(
         <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        
        background: "#121212",
        color: "#eee",
        padding: "20px"
        }}>
            <h1 style={{ fontSize: "2rem" }}>녹화 영상 목록</h1>
            <button onClick={left} style={buttonStyle}>나가기</button>
            <ul
                style={{
                width: "100%",
                maxWidth: "600px",
                listStyle: "none",
                padding: 0,
                }}
            >
                {videos.length === 0 && <p>녹화 영상이 없습니다.</p>}

                {videos
                    .filter(({ name }) => /^\d{8}/.test(name))
                    .map((v) => (
                    <li key={v.name} style={{ marginBottom: "20px" }}>
                        <video controls width="100%" src={v.url} />
                        <p style={{ textAlign: "center" }}>{formatDate(v.name)}</p>
                    </li>
                ))}
            </ul>

        </div>
    );
};

const buttonStyle = {
  padding: "12px 24px",
  fontSize: "1rem",
  background: "#1e1e1e",
  color: "#eee",
  border: "none",
  borderRadius: "10px",
  boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
  cursor: "pointer",
  margin: "20px 0"
};