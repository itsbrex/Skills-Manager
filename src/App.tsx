import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Skills } from "@/pages/Skills";
import { Tools } from "@/pages/Tools";
import { Sync } from "@/pages/Sync";
import { Settings } from "@/pages/Settings";
import { Welcome } from "@/pages/Welcome";
import { useInitialization } from "@/hooks/useInitialization";

function App() {
  const { isInitialized, isLoading, markInitialized } = useInitialization();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isInitialized) {
    return <Welcome onComplete={markInitialized} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Skills />} />
          <Route path="tools" element={<Tools />} />
          <Route path="sync" element={<Sync />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
