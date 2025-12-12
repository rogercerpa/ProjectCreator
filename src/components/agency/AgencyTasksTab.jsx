import React, { useState, useEffect } from 'react';

function AgencyTasksTab({ agency }) {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    assignedTo: '',
    status: 'pending'
  });
  const [showAddTask, setShowAddTask] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed', 'overdue'

  useEffect(() => {
    if (agency) {
      loadTasks();
    }
  }, [agency]);

  const loadTasks = async () => {
    // TODO: Load from extended agency data
    const agencyTasks = agency?.tasks || [];
    setTasks(agencyTasks);
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const task = {
      id: `task-${Date.now()}`,
      ...newTask,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User' // TODO: Get from user context
    };

    const updatedTasks = [task, ...tasks];
    setTasks(updatedTasks);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        tasks: updatedTasks
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save task');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task: ' + error.message);
      setTasks(tasks);
      return;
    }

    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      assignedTo: '',
      status: 'pending'
    });
    setShowAddTask(false);
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    );
    setTasks(updatedTasks);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        tasks: updatedTasks
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task: ' + error.message);
      setTasks(tasks);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        tasks: updatedTasks
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task: ' + error.message);
      setTasks(tasks);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    try {
      return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
    } catch {
      return false;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'in-progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'pending': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return isOverdue(task.dueDate) && task.status !== 'completed';
    return task.status === filter;
  });

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in-progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const overdueTasks = tasks.filter(t => isOverdue(t.dueDate) && t.status !== 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tasks & Action Items</h2>
        <button
          onClick={() => setShowAddTask(!showAddTask)}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
        >
          <span>+</span>
          <span>Add Task</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Tasks</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{tasks.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingTasks.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedTasks.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueTasks.length}</p>
        </div>
      </div>

      {/* Add Task Form */}
      {showAddTask && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Task</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Enter task title..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows="3"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assigned To
              </label>
              <input
                type="text"
                value={newTask.assignedTo}
                onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                placeholder="Person or team name..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddTask}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
              >
                Add Task
              </button>
              <button
                onClick={() => {
                  setNewTask({
                    title: '',
                    description: '',
                    priority: 'medium',
                    dueDate: '',
                    assignedTo: '',
                    status: 'pending'
                  });
                  setShowAddTask(false);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        {['all', 'pending', 'completed', 'overdue'].map(filterOption => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`px-4 py-2 font-medium text-sm transition-all border-b-2 ${
              filter === filterOption
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)} ({filterOption === 'all' ? tasks.length : filterOption === 'pending' ? pendingTasks.length : filterOption === 'completed' ? completedTasks.length : overdueTasks.length})
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No tasks found. Click "Add Task" to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
                isOverdue(task.dueDate) && task.status !== 'completed'
                  ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{task.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    {isOverdue(task.dueDate) && task.status !== 'completed' && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded text-xs font-medium">
                        Overdue
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>📅 {formatDate(task.dueDate)}</span>
                    {task.assignedTo && <span>👤 {task.assignedTo}</span>}
                    {task.createdAt && (
                      <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {task.status !== 'completed' && (
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all"
                      title="Mark as completed"
                    >
                      ✓
                    </button>
                  )}
                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all"
                      title="Mark as in progress"
                    >
                      →
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all"
                    title="Delete task"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AgencyTasksTab;

