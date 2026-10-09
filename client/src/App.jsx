import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CourtsProvider } from "./context/CourtsContext.jsx";
import DemoNotice from "./components/DemoNotice.jsx";
import Landing from "./pages/Landing.jsx";
import FindCourts from "./pages/FindCourts.jsx";
import Bookmarks from "./pages/Bookmarks.jsx";

export default function App() {
  return (
    <CourtsProvider>
      <BrowserRouter basename="/DinkSync">
        {/* <DemoNotice /> */}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/courts" element={<FindCourts />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
        </Routes>
      </BrowserRouter>
    </CourtsProvider>
  );
}
