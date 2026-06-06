import { Route, Routes } from "react-router-dom";

import { CreateRoomPage } from "./pages/create-room-page";
import { HomePage } from "./pages/home-page";
import { HostRoomPage } from "./pages/host-room-page";
import { NotFoundPage } from "./pages/not-found-page";
import { RoomPage } from "./pages/room-page";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/rooms/" element={<CreateRoomPage />} />
      <Route path="/rooms/:roomId" element={<RoomPage />} />
      <Route path="/rooms/:roomId/host" element={<HostRoomPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
