import { useMemo, useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const doubleCount = useMemo(() => {
    return count * 2
  }, [count])

  return (
    <main>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>Double count is {doubleCount}</p>
      </div>
    </main>
  )
}

export default App
