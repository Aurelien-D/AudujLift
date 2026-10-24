import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ActiveWorkoutBar } from './components/ActiveWorkoutBar'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RestTimerBar } from './components/RestTimerBar'
import { syncDefaultExercises } from './lib/db'
import Home from './pages/Home'

// Pages chargées à la demande pour alléger le premier affichage
const Profile = lazy(() => import('./pages/Profile'))
const AddFood = lazy(() => import('./pages/nutrition/AddFood'))
const FoodDetail = lazy(() => import('./pages/nutrition/FoodDetail'))
const FoodEditor = lazy(() => import('./pages/nutrition/FoodEditor'))
const Nutrition = lazy(() => import('./pages/nutrition/Nutrition'))
const RecipeEditor = lazy(() => import('./pages/nutrition/RecipeEditor'))
const ShoppingList = lazy(() => import('./pages/nutrition/ShoppingList'))
const PlatePhoto = lazy(() => import('./pages/nutrition/PlatePhoto'))
const Friends = lazy(() => import('./pages/social/Friends'))
const ShareImport = lazy(() => import('./pages/social/ShareImport'))
const Progress = lazy(() => import('./pages/progress/Progress'))
const WeeklyRecap = lazy(() => import('./pages/progress/WeeklyRecap'))
const ActiveWorkout = lazy(() => import('./pages/workout/ActiveWorkout'))
const ExerciseDetail = lazy(() => import('./pages/workout/ExerciseDetail'))
const ExerciseLibrary = lazy(() => import('./pages/workout/ExerciseLibrary'))
const History = lazy(() => import('./pages/workout/History'))
const Programs = lazy(() => import('./pages/workout/Programs'))
const RoutineEditor = lazy(() => import('./pages/workout/RoutineEditor'))
const WorkoutDetail = lazy(() => import('./pages/workout/WorkoutDetail'))
const Workouts = lazy(() => import('./pages/workout/Workouts'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Shell() {
  const { pathname } = useLocation()
  const inWorkout = pathname.startsWith('/workout/active')
  return (
    <>
      <ScrollToTop />
      <ErrorBoundary key={pathname}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/workouts/programs" element={<Programs />} />
            <Route path="/workouts/routine/:id" element={<RoutineEditor />} />
            <Route path="/workouts/history" element={<History />} />
            <Route path="/workouts/history/:id" element={<WorkoutDetail />} />
            <Route path="/workout/active" element={<ActiveWorkout />} />
            <Route path="/exercises" element={<ExerciseLibrary />} />
            <Route path="/exercises/:id" element={<ExerciseDetail />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/nutrition/add" element={<AddFood />} />
            <Route path="/nutrition/food/new" element={<FoodEditor />} />
            <Route path="/nutrition/food/:id/edit" element={<FoodEditor />} />
            <Route path="/nutrition/food/:id" element={<FoodDetail />} />
            <Route path="/nutrition/recipe/new" element={<RecipeEditor />} />
            <Route path="/nutrition/recipe/:id" element={<RecipeEditor />} />
            <Route path="/nutrition/shopping" element={<ShoppingList />} />
            <Route path="/nutrition/photo" element={<PlatePhoto />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/share" element={<ShareImport />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/recap" element={<WeeklyRecap />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      {!inWorkout && <ActiveWorkoutBar />}
      <RestTimerBar raised={!inWorkout} />
      {!inWorkout && <BottomNav />}
    </>
  )
}

export default function App() {
  useEffect(() => {
    void syncDefaultExercises()
    void navigator.storage?.persist?.()
  }, [])
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
