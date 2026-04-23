import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { LessonPage } from './pages/LessonPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'data-structures', element: <CategoryPage category="data-structures" /> },
      { path: 'data-structures/:slug', element: <LessonPage category="data-structures" /> },
      { path: 'system-design', element: <CategoryPage category="system-design" /> },
      { path: 'system-design/:slug', element: <LessonPage category="system-design" /> },
      { path: '404', element: <NotFoundPage /> },
      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },
]);
