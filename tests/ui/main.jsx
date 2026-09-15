import {ThemeProvider} from '../../src/lib/ThemeContext';
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import AdminPayments from '../../src/pages/admin/AdminPayments';
import AdminOperations from '../../src/pages/admin/AdminOperations';
import RideDestinationChange from '../../src/components/bear/RideDestinationChange';
import AccountDebtNotice from '../../src/components/bear/AccountDebtNotice';
import '../../src/index.css';
import PassengerShell from '../../src/pages/passenger/PassengerShell';
import DriverShell from '../../src/pages/driver/DriverShell';
import AccountHome from '../../src/pages/shared/AccountHome';
import MapBottomSheet from '../../src/components/bear/MapBottomSheet';
import RideHistory from '../../src/pages/shared/RideHistory';
import Wallet from '../../src/pages/shared/Wallet';
import PassengerProfile from '../../src/pages/passenger/PassengerProfile';
function MapPanel() {
 const [expanded,setExpanded]=useState(true);
 return <div style={{height:"100dvh",position:"relative"}} className="bg-secondary"><p className="p-5 text-xs text-muted-foreground">Mapa simulado · Prueba local del panel</p><div style={{position:"absolute",left:0,right:0,bottom:80}} className="p-3 max-w-md mx-auto"><MapBottomSheet title="¿A dónde vamos?" subtitle="Elegí tu destino y revisá el punto de encuentro" expanded={expanded} onToggle={()=>setExpanded(!expanded)}><input aria-label="Buscar destino" placeholder="¿A dónde vas?" className="w-full h-12 px-3 rounded-xl bg-secondary" />{expanded && <><div className="space-y-3 py-3">{Array.from({length:8},(_,i)=><button className="block w-full min-h-12 rounded-xl border text-left px-3" key={i}>Destino de prueba {i+1}</button>)}</div><button className="w-full min-h-12 rounded-xl bg-accent text-accent-foreground">Ver precio del viaje</button></>}</MapBottomSheet></div></div>;
}
function Change() {const [ride,setRide]=useState({id:'ride',status:'IN_PROGRESS',quoted_fare:8000});return <div className="p-4 max-w-md mx-auto"><h1>Viaje de prueba local</h1><p>Total actual: ${ride.final_fare||ride.quoted_fare}</p><RideDestinationChange ride={ride} onUpdated={setRide}/></div>;}
createRoot(document.getElementById('root')).render(<ThemeProvider><BrowserRouter><div className="p-4" hidden={window.location.pathname === "/map-panel" || window.location.pathname.startsWith("/passenger") || window.location.pathname.startsWith("/driver")}><p>Prueba local con datos simulados</p><nav className="flex gap-4"><Link to="/operations">Soporte</Link><Link to="/change">Cambio de destino</Link><Link to="/passenger/benefits">Deuda</Link></nav></div><Routes><Route path="/map-panel" element={<MapPanel />} /><Route path="/mobile/passenger" element={<PassengerShell />}><Route path="account" element={<AccountHome />} /></Route><Route path="/passenger" element={<PassengerShell />}><Route path="rides" element={<RideHistory />} /><Route path="account" element={<AccountHome />} /><Route path="account/personal" element={<PassengerProfile />} /><Route path="wallet" element={<Wallet />} /></Route><Route path="/driver" element={<DriverShell />}><Route path="rides" element={<RideHistory mode="driver" />} /><Route path="account" element={<AccountHome />} /><Route path="account/personal" element={<PassengerProfile />} /></Route><Route path="/payments" element={<div className="p-4"><AdminPayments/></div>}/><Route path="/operations" element={<div className="p-4"><AdminOperations/></div>}/><Route path="/change" element={<Change/>}/><Route path="*" element={<AccountDebtNotice><div>Beneficios</div></AccountDebtNotice>}/></Routes></BrowserRouter></ThemeProvider>);
