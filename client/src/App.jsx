import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CourtsProvider } from "./context/CourtsContext.jsx";
import Landing from "./pages/Landing.jsx";
import FindCourts from "./pages/FindCourts.jsx";

export default function App() {
  return (
    <CourtsProvider>
      <BrowserRouter basename="/DinkSync">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/courts" element={<FindCourts />} />
        </Routes>
      </BrowserRouter>
    </CourtsProvider>
  );
}
