import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { InternalInformationCollectionPage } from "./pages/InternalInformationCollectionPage";
import { OpsHomePage } from "./pages/OpsHomePage";

export function App() {
  return (
    <BrowserRouter>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="site-brand site-brand-link">
            StudyTour Ops
          </Link>
          <nav className="site-nav">
            <Link to="/">Home</Link>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<OpsHomePage />} />
        <Route
          path="/projects/:projectId/modules/internal-information-collection"
          element={<InternalInformationCollectionPage />}
        />
        <Route path="/modules/internal-information-collection" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
