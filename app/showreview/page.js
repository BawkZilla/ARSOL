"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { app }               from "@/lib/firebase";  
import { getDatabase, ref, get, set } from "firebase/database";
import { FaStar, FaRegStar } from "react-icons/fa";

function Stars({ count }) {
  const total = 5;                                    
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[...Array(total)].map((_, i) =>
        i < count ? (
          <FaStar key={i} color="#ffd700" />          
        ) : (
          <FaRegStar key={i} color="#555" />          
        )
      )}
    </div>
  );
}

export default function ShowReview() {
    const db = getDatabase(app); 
    const router  = useRouter();
    const [reviewUser, setReviewUser] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [userJob, setUserJob] = useState(null);

    useEffect(() => {
        setReviewUser(localStorage.getItem("nickname"));
    }, [])

    useEffect(()=> {
        const fetchJob = async () => {
        const snapshot = await get(ref(db, `users/${reviewUser}/job`));
        setUserJob(snapshot.val());
        }
        fetchJob();
    }, [reviewUser]);

    useEffect(() => {
        if (!reviewUser) return;
        const reviewsRef = ref(db, "reviews");
        get(reviewsRef).then((snap) => {
        if (!snap.exists()) {
            setReviews([]);
            return;
        }

        const filtered = Object.entries(snap.val())
            .filter(([_, v]) => v.expert === reviewUser || v.user === reviewUser)
            .map(([id, v]) => ({ id, ...v }));

        setReviews(filtered);
        });
    }, [db, reviewUser]);

    

    const left = () => {
        router.push('/rooms')
    };

    
    

    return (
        <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        background: "#121212",
        color: "#eee",
        padding: "20px"
        }}>
            <h1 style={{ fontSize: "2rem" }}>리뷰 목록</h1>
            <button onClick={left} style={buttonStyle}>나가기</button>
            <div
                style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "20px",
                width: "100%",
                maxWidth: "900px",
                marginTop: "20px",
                }}
            >
                {reviews.length === 0 ? (
                <p style={{ gridColumn: "1 / -1" }}>작성한 리뷰가 없습니다.</p>
                ) : (
                reviews.map((rv) => (
                    <div
                    key={rv.id}
                    style={{
                        background: "#1e1e1e",
                        borderRadius: "8px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                    }}
                    >
                    <Stars count={rv.rating} />
                    <strong>{rv.reviewContent}</strong>
                    {userJob === "전문가" ? (
                        <small>{rv.user}님의 리뷰</small>
                    ) : (
                        <small>{rv.expert}님에게 작성한 리뷰</small>
                    )}
                    </div>
                ))
                )}
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
  cursor: "pointer",
  margin: "20px 0"
};