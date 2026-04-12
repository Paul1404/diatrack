import { useState, useEffect } from 'react';
import Button from '@atlaskit/button/standard-button';
import Lozenge from '@atlaskit/lozenge';
import ProgressBar from '@atlaskit/progress-bar';
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from '@atlaskit/modal-dialog';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import {
  Device,
  EnumOption,
  getDevices,
  createDevice,
  endDevice,
  reportFailure,
  updateDevice,
  deleteDevice,
  getBodyLocations,
  getFailureReasons,
  getDeviceTypes,
} from '../services/api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import AddIcon from '@atlaskit/icon/core/add';
import CheckMarkIcon from '@atlaskit/icon/core/check-mark';
import DefectIcon from '@atlaskit/icon/core/defect';
import EditIcon from '@atlaskit/icon/core/edit';
import DeleteIcon from '@atlaskit/icon/core/delete';
import PulseIcon from '@atlaskit/icon/core/pulse';
import FlaskIcon from '@atlaskit/icon/core/flask';
import LocationIcon from '@atlaskit/icon/core/location';
import Tooltip from '@atlaskit/tooltip';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import ShowMoreHorizontalIcon from '@atlaskit/icon/core/show-more-horizontal';

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [bodyLocations, setBodyLocations] = useState<EnumOption[]>([]);
  const [failureReasons, setFailureReasons] = useState<EnumOption[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<EnumOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Device Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDeviceType, setNewDeviceType] = useState<string | null>(null);
  const [newBodyLocation, setNewBodyLocation] = useState<string | null>(null);
  const [newStartDate, setNewStartDate] = useState('');

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editStartDate, setEditStartDate] = useState('');

  // Failure Modal
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureDeviceId, setFailureDeviceId] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [failureNotes, setFailureNotes] = useState('');
  const [failureDate, setFailureDate] = useState('');

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDeviceId, setDeleteDeviceId] = useState<number | null>(null);

  // Load enums once on mount (these never change at runtime)
  useEffect(() => {
    async function loadEnums() {
      const [locationsRes, reasonsRes, typesRes] = await Promise.all([
        getBodyLocations(),
        getFailureReasons(),
        getDeviceTypes(),
      ]);
      if (locationsRes.data) setBodyLocations(locationsRes.data);
      if (reasonsRes.data) setFailureReasons(reasonsRes.data);
      if (typesRes.data) setDeviceTypes(typesRes.data);
    }
    loadEnums();
  }, []);

  // Load devices initially and refresh every 60s
  const loadDevices = async () => {
    const devicesRes = await getDevices(true);
    if (devicesRes.data) setDevices(devicesRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateDevice = async () => {
    if (!newDeviceType || !newBodyLocation) return;

    const { data } = await createDevice({
      device_type: newDeviceType as 'sensor' | 'catheter',
      body_location: newBodyLocation,
      start_time: newStartDate ? new Date(newStartDate).toISOString() : undefined,
    });

    if (data) {
      setDevices([data, ...devices]);
      setShowNewModal(false);
      setNewDeviceType(null);
      setNewBodyLocation(null);
      setNewStartDate('');
    }
  };

  const handleEndDevice = async (id: number) => {
    const { data } = await endDevice(id);
    if (data) {
      setDevices(devices.filter((d) => d.id !== id));
    }
  };

  const handleReportFailure = async () => {
    if (!failureDeviceId || !failureReason) return;

    const { data } = await reportFailure(
      failureDeviceId,
      failureReason,
      failureNotes || undefined,
      failureDate ? new Date(failureDate).toISOString() : undefined
    );

    if (data) {
      setDevices(devices.filter((d) => d.id !== failureDeviceId));
      setShowFailureModal(false);
      setFailureDeviceId(null);
      setFailureReason(null);
      setFailureNotes('');
      setFailureDate('');
    }
  };

  const confirmDeleteDevice = (id: number) => {
    setDeleteDeviceId(id);
    setShowDeleteModal(true);
  };

  const handleDeleteDevice = async () => {
    if (!deleteDeviceId) return;
    const { error } = await deleteDevice(deleteDeviceId);
    if (!error) {
      setDevices(devices.filter((d) => d.id !== deleteDeviceId));
    }
    setShowDeleteModal(false);
    setDeleteDeviceId(null);
  };

  const openEditModal = (device: Device) => {
    setEditDevice(device);
    // Convert UTC ISO to local datetime-local value
    const dt = new Date(device.start_time);
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    setEditStartDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    setShowEditModal(true);
  };

  const handleUpdateDevice = async () => {
    if (!editDevice || !editStartDate) return;
    const { data } = await updateDevice(editDevice.id, {
      start_time: new Date(editStartDate).toISOString(),
    });
    if (data) {
      setShowEditModal(false);
      setEditDevice(null);
      setEditStartDate('');
      await loadDevices();
    }
  };

  const openFailureModal = (deviceId: number) => {
    setFailureDeviceId(deviceId);
    setShowFailureModal(true);
  };

  const formatRemaining = (hours: number | null): string => {
    if (hours === null) return 'Aktiv';
    if (hours < 1) {
      const mins = Math.max(0, Math.round(hours * 60));
      return `${mins}min übrig`;
    }
    if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}h ${m}min übrig` : `${h}h übrig`;
    }
    const days = Math.floor(hours / 24);
    const h = Math.round(hours - days * 24);
    return h > 0 ? `${days}d ${h}h übrig` : `${days}d übrig`;
  };

  const getProgressAppearance = (progress: number | null): 'default' | 'success' | 'inverse' => {
    if (progress === null) return 'default';
    if (progress >= 90) return 'inverse';
    return 'success';
  };

  const getCardClass = (device: Device): string => {
    const progress = device.progress_percent || 0;
    let cls = `device-card ${device.device_type}`;
    if (progress >= 90) cls += ' danger';
    else if (progress >= 75) cls += ' warning';
    return cls;
  };

  if (isLoading) {
    return <div>Laden...</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <Button appearance="primary" iconBefore={<AddIcon label="" />} onClick={() => setShowNewModal(true)}>
          Neues Gerät
        </Button>
      </div>

      {devices.length === 0 ? (
        <div className="card empty-state">
          <h3>Keine aktiven Geräte</h3>
          <p>Füge ein neues Gerät hinzu, um mit dem Tracking zu beginnen.</p>
          <Button appearance="primary" iconBefore={<AddIcon label="" />} onClick={() => setShowNewModal(true)}>
            Erstes Gerät hinzufügen
          </Button>
        </div>
      ) : (
        <div className="device-grid">
          {devices.map((device) => (
            <div key={device.id} className={getCardClass(device)}>
              <div className="device-header">
                <div>
                  <div className="device-type">
                    {device.device_type === 'sensor'
                      ? <><PulseIcon label="" /> Sensor</>
                      : <><FlaskIcon label="" /> Katheter</>}
                  </div>
                  <div className="device-location"><LocationIcon label="" /> {device.body_location_label}</div>
                </div>
                <Lozenge
                  appearance={
                    (device.progress_percent || 0) >= 90
                      ? 'removed'
                      : (device.progress_percent || 0) >= 75
                      ? 'moved'
                      : 'success'
                  }
                >
                  {formatRemaining(device.remaining_hours)}
                </Lozenge>
              </div>

              <div className="device-progress">
                <ProgressBar
                  value={(device.progress_percent || 0) / 100}
                  appearance={getProgressAppearance(device.progress_percent)}
                />
                <div className="device-time">
                  <span>
                    Gestartet:{' '}
                    {format(new Date(device.start_time), 'dd.MM.yyyy HH:mm', {
                      locale: de,
                    })}
                  </span>
                  <span>{Math.round(device.progress_percent || 0)}%</span>
                </div>
              </div>

              <div className="device-actions">
                <Button
                  appearance="primary"
                  iconBefore={<CheckMarkIcon label="" />}
                  onClick={() => handleEndDevice(device.id)}
                >
                  Beenden
                </Button>
                <Button
                  appearance="danger"
                  iconBefore={<DefectIcon label="" />}
                  onClick={() => openFailureModal(device.id)}
                >
                  Defekt
                </Button>
                <DropdownMenu
                  trigger={({ triggerRef, ...props }) => (
                    <Tooltip content="Weitere Aktionen">
                      <Button
                        {...props}
                        ref={triggerRef}
                        appearance="subtle"
                        spacing="compact"
                        iconBefore={<ShowMoreHorizontalIcon label="Weitere Aktionen" />}
                      />
                    </Tooltip>
                  )}
                  placement="bottom-end"
                >
                  <DropdownItemGroup>
                    <DropdownItem
                      onClick={() => openEditModal(device)}
                      elemBefore={<EditIcon label="" />}
                    >
                      Startzeit bearbeiten
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => confirmDeleteDevice(device.id)}
                      elemBefore={<DeleteIcon label="" />}
                    >
                      Gerät löschen
                    </DropdownItem>
                  </DropdownItemGroup>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Device Modal */}
      <ModalTransition>
        {showNewModal && (
          <Modal onClose={() => setShowNewModal(false)}>
            <ModalHeader>
              <ModalTitle>Neues Gerät hinzufügen</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label>Gerätetyp</label>
                <Select
                  options={deviceTypes.map((t) => ({ value: t.value, label: t.label }))}
                  onChange={(option) => setNewDeviceType(option?.value || null)}
                  placeholder="Typ auswählen..."
                />
              </div>
              <div className="form-field">
                <label>Körperstelle</label>
                <Select
                  options={bodyLocations.map((l) => ({ value: l.value, label: l.label }))}
                  onChange={(option) => setNewBodyLocation(option?.value || null)}
                  placeholder="Stelle auswählen..."
                />
              </div>
              <div className="form-field">
                <label>Startzeit (optional, Standard: jetzt)</label>
                <input
                  type="datetime-local"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 6px',
                    border: '2px solid #DFE1E6',
                    borderRadius: '3px',
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setShowNewModal(false)}>
                Abbrechen
              </Button>
              <Button
                appearance="primary"
                onClick={handleCreateDevice}
                isDisabled={!newDeviceType || !newBodyLocation}
              >
                Hinzufügen
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>

      {/* Edit Device Modal */}
      <ModalTransition>
        {showEditModal && editDevice && (
          <Modal onClose={() => setShowEditModal(false)}>
            <ModalHeader>
              <ModalTitle>
                {editDevice.device_type === 'sensor'
                  ? <><PulseIcon label="" /> Sensor bearbeiten</>
                  : <><FlaskIcon label="" /> Katheter bearbeiten</>}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label>Startzeit</label>
                <input
                  type="datetime-local"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 6px',
                    border: '2px solid #DFE1E6',
                    borderRadius: '3px',
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setShowEditModal(false)}>
                Abbrechen
              </Button>
              <Button
                appearance="primary"
                onClick={handleUpdateDevice}
                isDisabled={!editStartDate}
              >
                Speichern
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>

      {/* Failure Modal */}
      <ModalTransition>
        {showFailureModal && (
          <Modal onClose={() => setShowFailureModal(false)}>
            <ModalHeader>
              <ModalTitle appearance="warning">Defekt melden</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label>Grund</label>
                <Select
                  options={failureReasons.map((r) => ({ value: r.value, label: r.label }))}
                  onChange={(option) => setFailureReason(option?.value || null)}
                  placeholder="Grund auswählen..."
                />
              </div>
              <div className="form-field">
                <label>Zeitpunkt des Defekts</label>
                <Textfield
                  type="datetime-local"
                  value={failureDate}
                  onChange={(e) =>
                    setFailureDate((e.target as HTMLInputElement).value)
                  }
                />
                <small style={{ color: '#626F86', marginTop: '4px', display: 'block' }}>
                  Leer lassen für "jetzt"
                </small>
              </div>
              <div className="form-field">
                <label>Notizen (optional)</label>
                <Textfield
                  value={failureNotes}
                  onChange={(e) =>
                    setFailureNotes((e.target as HTMLInputElement).value)
                  }
                  placeholder="Zusätzliche Informationen..."
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setShowFailureModal(false)}>
                Abbrechen
              </Button>
              <Button
                appearance="warning"
                onClick={handleReportFailure}
                isDisabled={!failureReason}
              >
                Defekt melden
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>

      {/* Delete Confirmation Modal */}
      <ModalTransition>
        {showDeleteModal && (
          <Modal onClose={() => setShowDeleteModal(false)} width="small">
            <ModalHeader>
              <ModalTitle appearance="danger">Gerät löschen</ModalTitle>
            </ModalHeader>
            <ModalBody>
              Dieses Gerät wird unwiderruflich gelöscht. Alle zugehörigen Daten
              gehen dabei verloren. Dieser Vorgang kann nicht rückgängig gemacht werden.
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setShowDeleteModal(false)}>
                Abbrechen
              </Button>
              <Button appearance="danger" onClick={handleDeleteDevice}>
                Löschen
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}
