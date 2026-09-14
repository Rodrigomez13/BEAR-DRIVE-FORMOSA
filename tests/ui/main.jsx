import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import AdminPayments from '../../src/pages/admin/AdminPayments';
import AdminOperations from '../../src/pages/admin/AdminOperations';
import RideDestinationChange from '../../src/components/bear/RideDestinationChange';
import AccountDebtNotice from '../../src/components/bear/AccountDebtNotice';
import '../../src/index.css';
function Change() {const [ride,setRide]=useState({id:'ride',status:'IN_PROGRESS',quoted_fare:8000});return <div className="p-4 max-w-md mx-auto"><h1>Viaje de prueba local</h1><p>Total actual: ${ride.final_fare||ride.quoted_fare}</p><RideDestinationChange ride={ride} onUpdated={setRide}/></div>;}
createRoot(document.getElementById('root')).render(<BrowserRouter><div className="p-4"><p>Prueba local con datos simulados</p><nav className="flex gap-4"><Link to="/operations">Soporte</Link><Link to="/change">Cambio de destino</Link><Link to="/passenger/benefits">Deuda</Link></nav></div><Routes><Route path="/payments" element={<div className="p-4"><AdminPayments/></div>}/><Route path="/operations" element={<div className="p-4"><AdminOperations/></div>}/><Route path="/change" element={<Change/>}/><Route path="*" element={<AccountDebtNotice><div>Beneficios</div></AccountDebtNotice>}/></Routes></BrowserRouter>);
