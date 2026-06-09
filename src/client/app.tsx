import { Route, Routes } from "react-router-dom";

import { CreateRoomPage } from "./pages/create-room-page";
import { HomePage } from "./pages/home-page";
import { NotFoundPage } from "./pages/not-found-page";
import { RoomEntryPage } from "./pages/room-entry-page";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/rooms/" element={<CreateRoomPage />} />
      <Route path="/rooms/:roomId" element={<RoomEntryPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
