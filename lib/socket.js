//test
import { io } from "socket.io-client";
export const socket = io("https://ggg-ar-sol.org/", {
	path: "/socket.io",
});
