import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import useGoogleMaps from '../../components/Map/useGoogleMaps';
import TaskMiniMap from '../../components/Map/TaskMiniMap';
import { useI18n } from '../../i18n';

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate();
  const mapsLoaded = useGoogleMaps();
  const { t } = useI18n();

  useEffect(() => {
    api.get('/tasks/mine').then(({ data }) => setTasks(data));
  }, []);

  return (
    <div className="page">
      <h2>{t('myTasks.title')}</h2>
      {tasks.length === 0 && <p className="empty-state">{t('myTasks.empty')}</p>}
      <div className="task-list">
        {tasks.map((task) => (
          <div key={task.id} className="task-card clickable" onClick={() => navigate(`/task/${task.id}`)}>
            <div className="task-header">
              <h3>{task.title}</h3>
              <span className="task-dates">
                {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
              </span>
            </div>
            {mapsLoaded && task.area && <TaskMiniMap area={task.area} />}
            <div className="task-meta">
              {t('tasks.usersAssigned', { count: task.assignments.length })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
