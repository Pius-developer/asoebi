import { Link } from '../lib/router.jsx';
import { PublicShell } from '../components/Shell.jsx';
import Icon from '../components/Icon.jsx';
import { Swatches } from '../components/ui.jsx';

const DEMO = [
  { name: 'Gele + Ipele', price: '₦25,000', color: '#7C3AED', left: 'Only 4 left' },
  { name: "Men's fabric", price: '₦18,000', color: '#D4A017' },
  { name: 'Cap', price: '₦5,000', color: '#DB2777' },
];

export default function Landing() {
  return (
    <PublicShell wide>
      <section className="hero">
        <div className="container hero-in">
          <div className="hero-copy">
            <span className="hero-tag"><Swatches colors={['#7C3AED', '#D4A017', '#DB2777']} size={18} />For weddings, birthdays and every owambe</span>
            <h1>Your aso-ebi,<br />sorted.</h1>
            <p className="lead">One link for your guests to pick their fabric, pay and show proof. You see who has paid and who has collected, without a messy WhatsApp list.</p>
            <div className="btn-row">
              <Link to="/signup" className="btn btn-primary btn-lg">Start for free <Icon name="arrow" size={18} /></Link>
              <a href="#how" className="btn btn-ghost btn-lg">How it works</a>
            </div>
            <p className="hero-note"><Icon name="lock" size={16} />Aso-ebi never holds money. Guests pay you directly.</p>
          </div>

          <div className="phone-mock" aria-hidden="true">
            <div className="phone">
              <div className="pm-cover"><Swatches colors={['#7C3AED', '#D4A017', '#DB2777', '#C4B5FD']} size={64} /></div>
              <div className="pm-body">
                <small>Tolu invites you to wear our aso-ebi</small>
                <h3>Tolu &amp; Femi's wedding</h3>
                <div className="pm-duel"><i style={{ flexGrow: 34 }}><b>34</b></i><i style={{ flexGrow: 28 }}><b>28</b></i></div>
                <div className="pm-duel-l"><span>Bride's side</span><span>Groom's side</span></div>
                {DEMO.map((d) => (
                  <div className="pm-item" key={d.name}>
                    <span className="pm-sw" style={{ background: d.color }} />
                    <div><b>{d.name}</b><span>{d.price}</span></div>
                    {d.left ? <em>{d.left}</em> : <i>+</i>}
                  </div>
                ))}
                <div className="pm-cart"><span>2 items · ₦43,000</span><b>Continue</b></div>
              </div>
            </div>
            <div className="float f1"><span className="pill pill-ok">Paid</span>Ada · ₦25,000</div>
            <div className="float f2"><Icon name="users" size={18} />62 people in our colours</div>
          </div>
        </div>
      </section>

      <section className="band" id="how">
        <div className="container">
          <h2>Set up in five minutes</h2>
          <div className="steps3">
            <div><span>1</span><h3>Add your fabrics</h3><p>Photos, prices and how many you have. Add the account guests should pay into.</p></div>
            <div><span>2</span><h3>Share one link</h3><p>Post it in the family WhatsApp group. Guests order with their name and phone. No app, no account.</p></div>
            <div><span>3</span><h3>Confirm and hand out</h3><p>Guests tap "I've paid" with a receipt. You confirm in one tap and tick them off when they collect.</p></div>
          </div>
        </div>
      </section>

      <section className="band band-soft">
        <div className="container split">
          <div>
            <h2>Bride's side vs Groom's side</h2>
            <p className="lead">Every guest picks a side when they order, and your page shows a live tally. Watch the aunties make sure their side wins. 😄</p>
          </div>
          <div className="duel-demo">
            <div className="duel-head"><span>Bride's side</span><b>vs</b><span>Groom's side</span></div>
            <div className="duel"><i style={{ flexGrow: 34 }}><b>34</b></i><i style={{ flexGrow: 28 }}><b>28</b></i></div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <h2>Everything the WhatsApp list can't do</h2>
          <div className="feats">
            {[
              ['receipt', '"I\'ve paid" with proof', 'Guests attach their transfer screenshot. You confirm or mark "not received".'],
              ['fabric', 'Stock that counts itself', 'Set how many of each fabric you have. It shows "Only 4 left" and can\'t be oversold.'],
              ['bag', 'Who has collected', 'Tick people off as they pick up. No more "did I give you yours?"'],
              ['wa', 'Reminders on WhatsApp', 'One tap writes a polite reminder with their order link.'],
              ['download', 'Export for your tailor', 'Download everything as a spreadsheet: names, sizes, fabrics, payments.'],
              ['share', 'A share card for status', '"We\'re wearing aso-ebi for…" with your fabric colours, ready for WhatsApp status.'],
            ].map(([ic, t, d]) => (
              <div className="feat" key={t}><span className="feat-ic"><Icon name={ic} size={22} /></span><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container cta">
          <h2>Your guests will thank you.</h2>
          <p className="lead">Free for every celebrant. Set up your aso-ebi today.</p>
          <Link to="/signup" className="btn btn-light btn-lg">Start for free <Icon name="arrow" size={18} /></Link>
        </div>
      </section>
    </PublicShell>
  );
}
