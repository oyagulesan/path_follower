import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import TaskMiniMap from '../../components/Map/TaskMiniMap';
import { useI18n } from '../../i18n';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', startDate: '', endDate: '', area: null });
  const [selectedTask, setSelectedTask] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const polygonRef = useRef(null);
  const { t } = useI18n();

  const fetchTasks = async () => {
    const { data } = await api.get('/tasks');
    setTasks(data);
  };

  const fetchUsers = async () => {
    const { data } = await api.get('/users');
    setUsers(data);
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!window.google?.maps) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 41.0082, lng: 28.9784 },
      zoom: 12,
    });
    mapInstanceRef.current = map;

    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: window.google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        fillColor: '#4A90D9',
        fillOpacity: 0.3,
        strokeWeight: 2,
        editable: true,
      },
    });
    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    window.google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      polygonRef.current = polygon;
      drawingManager.setDrawingMode(null);

      const path = polygon.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
      setForm((prev) => ({ ...prev, area: path }));

      window.google.maps.event.addListener(polygon.getPath(), 'set_at', () => {
        const updated = polygon.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
        setForm((prev) => ({ ...prev, area: updated }));
      });
      window.google.maps.event.addListener(polygon.getPath(), 'insert_at', () => {
        const updated = polygon.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
        setForm((prev) => ({ ...prev, area: updated }));
      });
    });
  }, []);

  useEffect(() => {
    if (window.google?.maps) {
      initMap();
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', initMap);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);
  }, [initMap]);

  const showPolygonOnMap = (area) => {
    if (!mapInstanceRef.current || !area) return;
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }
    const polygon = new window.google.maps.Polygon({
      paths: area,
      fillColor: '#4A90D9',
      fillOpacity: 0.3,
      strokeWeight: 2,
      editable: true,
    });
    polygon.setMap(mapInstanceRef.current);
    polygonRef.current = polygon;

    const bounds = new window.google.maps.LatLngBounds();
    area.forEach((p) => bounds.extend(p));
    mapInstanceRef.current.fitBounds(bounds);

    window.google.maps.event.addListener(polygon.getPath(), 'set_at', () => {
      const updated = polygon.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
      setForm((prev) => ({ ...prev, area: updated }));
    });
    window.google.maps.event.addListener(polygon.getPath(), 'insert_at', () => {
      const updated = polygon.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
      setForm((prev) => ({ ...prev, area: updated }));
    });
  };

  const resetForm = () => {
    setForm({ title: '', startDate: '', endDate: '', area: null });
    setEditing(null);
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
    }
  };

  const handleEdit = (task) => {
    setEditing(task.id);
    setForm({
      title: task.title,
      startDate: task.startDate.slice(0, 10),
      endDate: task.endDate.slice(0, 10),
      area: task.area,
    });
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
    showPolygonOnMap(task.area);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.area) {
      toast.error(t('tasks.noAreaDrawn'));
      return;
    }
    try {
      if (editing) {
        await api.put(`/tasks/${editing}`, form);
        toast.success(t('tasks.updated'));
      } else {
        await api.post('/tasks', form);
        toast.success(t('tasks.created'));
      }
      resetForm();
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || t('tasks.errorSaving'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('tasks.confirmDelete'))) return;
    try {
      await api.delete(`/tasks/${id}`);
      toast.success(t('tasks.deleted'));
      fetchTasks();
      if (selectedTask === id) setSelectedTask(null);
    } catch {
      toast.error(t('tasks.errorDeleting'));
    }
  };

  const handleAssign = async (taskId, userId) => {
    try {
      await api.post(`/tasks/${taskId}/assignments`, { userId });
      toast.success(t('tasks.userAssigned'));
      fetchTasks();
    } catch {
      toast.error(t('tasks.errorAssigning'));
    }
  };

  const handleUnassign = async (taskId, userId) => {
    try {
      await api.delete(`/tasks/${taskId}/assignments/${userId}`);
      toast.success(t('tasks.userRemoved'));
      fetchTasks();
    } catch {
      toast.error(t('tasks.errorRemoving'));
    }
  };

  return (
    <div className="page">
      <h2>{t('tasks.title')}</h2>

      <form onSubmit={handleSubmit} className="form-card">
        <h3>{editing ? t('tasks.editTask') : t('tasks.createTask')}</h3>
        <div className="form-grid">
          <input
            placeholder={t('tasks.taskTitle')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            required
          />
        </div>
        <div ref={mapRef} className="map-container" />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{editing ? t('common.update') : t('common.create')}</button>
          {editing && <button type="button" className="btn" onClick={resetForm}>{t('common.cancel')}</button>}
        </div>
      </form>

      <div className="task-list">
        {tasks.map((task) => (
          <div key={task.id} className="task-card">
            <div className="task-header">
              <h3>{task.title}</h3>
              <span className="task-dates">
                {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
              </span>
            </div>
            {task.area && <TaskMiniMap area={task.area} />}
            <div className="task-actions">
              <button className="btn btn-sm" onClick={() => handleEdit(task)}>{t('common.edit')}</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(task.id)}>{t('common.delete')}</button>
              <button className="btn btn-sm" onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}>
                {selectedTask === task.id ? t('tasks.hideAssignments') : t('tasks.manageAssignments')}
              </button>
            </div>
            {selectedTask === task.id && (
              <div className="assignments">
                <h4>{t('tasks.assignedUsers')}</h4>
                <div className="assignment-list">
                  {task.assignments.map((a) => (
                    <div key={a.id} className="assignment-item">
                      <span>{a.user.name} {a.user.lastName} ({a.user.userId})</span>
                      <button className="btn btn-sm btn-danger" onClick={() => handleUnassign(task.id, a.user.id)}>{t('tasks.remove')}</button>
                    </div>
                  ))}
                </div>
                <div className="assignment-add">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssign(task.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>{t('tasks.addUser')}</option>
                    {users
                      .filter((u) => !task.assignments.some((a) => a.user.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.name} {u.lastName} ({u.userId})</option>
                      ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
