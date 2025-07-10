import { rooms } from "../../lib/db";

export default function handler(req, res) {
    const roomList = Object.keys(rooms).map(id => ({
        id,
        count: rooms[id].length
    }));
    res.status(200).json(roomList);
}
