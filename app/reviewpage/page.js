"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { app }               from "@/lib/firebase";  
import { getDatabase, ref, get, set } from "firebase/database";
import StarsRating from 'react-star-rate';

export default function Review() {
    const db = getDatabase(app); 
    const router  = useRouter();
    const [user, setUser] = useState(null);
    const [expert, setExpert] = useState(null);
    const [reviewSerialNum, setReviewSerialNum] = useState(null);
    const [reviewContent, setReviewContent] = useState("");
    const [star, setStar] = useState(0);

    useEffect(() => {
        setUser(localStorage.getItem("nickname"));
        setExpert(localStorage.getItem("expert"));
        setReviewSerialNum(localStorage.getItem("id"));
    }, [])

    useEffect(() => {
        return () => {
            window.localStorage.removeItem("id");
            window.localStorage.removeItem("expert");
        };
    }, []);

    const initialize = () => {
        setStar(0);
        setReviewContent("");
        setExpert(null);
        setReviewSerialNum(null);
        setUser(null);
        window.localStorage.removeItem("id");
        window.localStorage.removeItem("expert");
        router.push('/rooms');
    };

    const storeReview = async () =>{
        const reviewRef = ref(db, `reviews/${reviewSerialNum}`);
        await set(reviewRef, {user, expert, reviewContent, rating: star})
        .then(() => {
            toast.info("리뷰 작성이 완료되었습니다");
            initialize();
        })
        .catch(err => alert("저장 오류: "+err.code));
    };


    

    return (
        <div style={{ minHeight: "100vh", background: "#121212", color: "#eee", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", padding: "20px" }}>
            <ToastContainer position="top-center" />
            <h1 style={{ fontSize: "2rem" }}>{expert}님의 서비스는 어떠셨나요?</h1>
            <textarea placeholder="게시물 내용" value={reviewContent} onChange={(e) => {setReviewContent(e.target.value)}} style={{ ...inputStyle, height: "100px" }} />
            <StarsRating
                value={star}
                count={5}            
                allowHalf={false}    
                onChange={setStar}
                style={{ fontSize: 28, color: '#FFD700' }} 
            />
            <div style={{display: "flex", justifyContent: "center", gap: "20px"}}>
                <button onClick={storeReview} style={{...buttonStyle, background: "#444"}}>리뷰 작성</button>
                <button onClick={initialize} style={buttonStyle}>나가기</button>
            </div>
            
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
  cursor: "pointer"
};

const inputStyle = {
  padding: "10px",
  fontSize: "1rem",
  borderRadius: "8px",
  border: "1px solid #555",
  background: "#1e1e1e",
  color: "#eee",
  width: "80%",
  maxWidth: "400px"
};