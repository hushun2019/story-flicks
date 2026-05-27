import StoryForm from './components/StoryFrom';
import './App.css'
import LanguageSelect from './components/LanguageSelect';
import VideoResult from './components/VideoResult';
import './locales/index';

function App() {
  return (
    <div className="app">
      <div className="appMainArea">
        <div className="appLeft">
          <LanguageSelect />
          <StoryForm />
        </div>
        <div className="appRight">
          <VideoResult />
        </div>
      </div>
    </div>
  )
}

export default App
