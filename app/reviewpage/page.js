"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { app }               from "@/lib/firebase";  
import { getDatabase, ref, get, set } from "firebase/database";

export default function Review() {
    const db = getDatabase(app); 
    const router  = useRouter();
    const [expert, setExpert] = useState(null);
    useEffect(() => {
        setExpert(localStorage.getItem("expert"));
    }, [])

    return (
        <div>
            <h1>reviewpage {expert}</h1>
        </div>
    );
};