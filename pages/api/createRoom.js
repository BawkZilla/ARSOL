import { rooms } from "../../lib/db";

export default function handler(req, res) {
    if (req.method === "POST") {
        const { roomId } = req.body;
        if (!rooms[roomId]) rooms[roomId] = [];
        return res.status(200).json({ success: true, roomId });
    }
    return res.status(405).json({ message: "Method not allowed" });
}
