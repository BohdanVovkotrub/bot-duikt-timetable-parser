import axios from "axios";
import jsdom   from 'jsdom';
import qs from 'querystring';
import EventEmitter from "events";

export default class ERozklad {
  csrfFrontend;
  cookies;
  parsedSchedule;
  delayedUpdate;

  constructor(facultyId, course, groupId, update = false) {
    this.erozkladUrl = process.env.EROZKLAD_URL || 'http://e-rozklad.dut.edu.ua/time-table/group?type=0';
    this.updateInterval = 1 * 60 * 1000; // milliseconds
    this.update = update;
    this.facultyId = facultyId; // 1; // Навчально-науковий інститут Інформаційних технологій
    this.course = course; // 5; // 5 курс
    this.groupId = groupId; // 928; // ІСДМ-53
    this.csrfFrontendCookieName = '_csrf-frontend';
    this.week = this.getCurrentWeek();
    
    this.emitter = new EventEmitter();
    this.emitter.on('changed', this.onScheduleIsChanged);

    // Чтоб найти facultyId, groupId, course
    // нужно в браузере открыть своё расписание и через DevTools открыть вкладку Network и найти там "group?type=0"
    // нажать на "group?type=0" и выбрать вкладку Payload и там всё увидите
  };

  onScheduleIsChanged = (changes) => {
    console.log(`Schedule was changed: ${changes}`);
  };

  getCurrentWeek = () => {
    const today = new Date();
    const currentDay = today.getDay(); 
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1; 
    const firstDayOfWeek = new Date(today); 
    firstDayOfWeek.setDate(today.getDate() - diffToMonday); 
  
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); 
  
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const firstDayFormatted = firstDayOfWeek.toLocaleDateString('en-GB', options);
    const lastDayFormatted = lastDayOfWeek.toLocaleDateString('en-GB', options);
    const todayFormatted = today.toLocaleDateString('en-GB', options);
  
    return {
      firstDay: firstDayFormatted,
      lastDay: lastDayFormatted,
      today: todayFormatted,
    };
  }

  getCrsf = async () => {
    const response = await axios.get(this.erozkladUrl );
    this.cookies = response.headers['set-cookie'];
    const { document } = new jsdom.JSDOM(response.data).window;
    this.csrfFrontend = document.querySelector('meta[name="csrf-token"]').content;
    return this.csrfFrontend;
  };

  makeFormData = async () => {
    if (!this.csrfFrontend) await this.getCrsf();
    return qs.stringify({
      'TimeTableForm[facultyId]': this.facultyId,
      'TimeTableForm[course]': this.course,
      'TimeTableForm[groupId]': this.groupId,
      '_csrf-frontend': this.csrfFrontend,
    });
  };

  static dateStrToTimestamp = (dateStr, timeStr = null) => {
    const parts = dateStr.split('.');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    let hours = 0;
    let minutes  = 0;
    if (!!timeStr) {
      const timeParts = timeStr.split(':'); 
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
    };
    const date = new Date(year, month, day, hours, minutes);
    return Math.floor(date.getTime() / 1000);
  };

  findTable = async () => {
    const formData = await this.makeFormData();
    
    const options = {
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      Cookie: this.cookies,
      data: formData,
      url: this.erozkladUrl,
    };
    
    const response = await axios(options);

    const { document } = new jsdom.JSDOM(response.data).window;
    const table = document.querySelector('#timeTable');
    const parsedSchedule = this.parseTable(table);
    if (this.update === true) {
      this.delayedUpdate = setTimeout(this.findTable, this.updateInterval);
    };

    this.parsedSchedule = parsedSchedule;
    return this.parsedSchedule;
  };


  parseTable = (table) => {
    const parsed = [];

    const tbody = table.querySelector('tbody');
    const rows = [...tbody.querySelectorAll('tr')];

    const headsDaysOfWeek = rows.filter(row => row.querySelector('.headday'))

    headsDaysOfWeek.forEach((headDay, index) => {
      const rowsOfThisDay = (index === 6) 
        ? rows.filter(row => rows.indexOf(row) > rows.indexOf(headDay))
        : rows.filter(row => rows.indexOf(row) > rows.indexOf(headDay) && rows.indexOf(row) < rows.indexOf(headsDaysOfWeek[index + 1]));

      const dates = [...headDay.children];
      const dayOfWeek = dates[0].textContent;    

      for (let dateIndex = 1; dateIndex < dates.length; dateIndex++) {
        const dateStr = dates[dateIndex].textContent;
        const resultOfDay = { 
          dayOfWeek, 
          dateStr,
          date: ERozklad.dateStrToTimestamp(dateStr),
          lessons: [],
        };
        
        for (let lessonIndex = 1; lessonIndex < rowsOfThisDay.length; lessonIndex++) {
          const timeCell = [...rowsOfThisDay[lessonIndex].children][0];
          const startStr = timeCell.querySelector('.start').textContent;
          const endStr = timeCell.querySelector('.end').textContent;

          const lesson = {
            numberName: timeCell.querySelector('.lesson').textContent,
            startStr, 
            endStr,
            start: ERozklad.dateStrToTimestamp(dateStr, startStr),
            end: ERozklad.dateStrToTimestamp(dateStr, endStr),
            name: [...rowsOfThisDay[lessonIndex].children][dateIndex].textContent.trim().split('\n').map(part => part.trim()).join(' - '),
            fullname: [...rowsOfThisDay[lessonIndex].children][dateIndex].querySelector('[data-content]')?.dataset.content.replace(/<[^>]+>/g, ' - '),
          };
          if (!!lesson.name) resultOfDay.lessons.push(lesson);
        };

        parsed.push(resultOfDay)
      };
    });

    
    return parsed.sort((a, b) => a.date - b.date);
  };


  findByDate = async (dateTimestamp) => {
    if (!this.parsedSchedule) await this.findTable();
    const dateSchedule = this.parsedSchedule.find(({date}) => date === dateTimestamp);
    return !dateSchedule ? null : dateSchedule;
  };

  findByDateStr = async (dateStr) => {
    const dateTimestamp = ERozklad.dateStrToTimestamp(dateStr);
    return await this.findByDate(dateTimestamp);
  };

  getToday = async () => {
    const currentDate = () => {
      const today = new Date();

      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();

      return `${day}.${month}.${year}`;
    };

    return await this.findByDateStr(currentDate());
  };

  getTomorrow = async () => {
    const tomorrowDate = () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const day = String(tomorrow.getDate()).padStart(2, '0');
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const year = tomorrow.getFullYear();

      return `${day}.${month}.${year}`;
    };

    return await this.findByDateStr(tomorrowDate());
  };

  getDayOfThisMonth = async (dayOfMonth) => {
    function getDate() {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const currentDay = today.getDate();
      if (dayOfMonth >= currentDay) {
        const targetDate = new Date(currentYear, currentMonth, dayOfMonth);

        const day = String(targetDate.getDate()).padStart(2, '0'); 
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const year = targetDate.getFullYear();

        return `${day}.${month}.${year}`;
      } else {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const targetDate = new Date(nextYear, nextMonth, dayOfMonth);

        const day = String(targetDate.getDate()).padStart(2, '0');
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const year = targetDate.getFullYear();

        return `${day}.${month}.${year}`;
      }
    };

    return await this.findByDateStr(getDate());
  };

  getDayOfThisWeek = async (dayNumber) => {
    const getDateOfSpecificDayOfWeek = () => {
      const today = new Date();
      const currentDayOfWeek = today.getDay();
      const daysUntilTargetDay = dayNumber - currentDayOfWeek;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntilTargetDay + (daysUntilTargetDay < 0 ? 7 : 0));
    
      const day = String(targetDate.getDate()).padStart(2, '0');
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const year = targetDate.getFullYear();
    
      return `${day}.${month}.${year}`;
    };

    return await this.findByDateStr(getDateOfSpecificDayOfWeek());
  };


  getMondayOfThisWeek = async () => {
    return await this.getDayOfThisWeek(1);
  };

  getTuesdayOfThisWeek = async () => {
    return await this.getDayOfThisWeek(2);
  };

  getWednesdayOfThisWeek = async () => {
    return await this.getDayOfThisWeek(3);
  };

  getThursdayOfThisWeek = async () => {
    return await this.getDayOfThisWeek(4);
  };

  getFridayOfThisWeek = async () => {
    return await this.getDayOfThisWeek(5);
  };

  getSaturdayOfThisWeek = async () => {
    return await this.getDayOfThisWeek(6);
  };

  getSundayOfThisWeek = async () => {
    return await this.getDayOfThisWeek(0);
  };
};



// const rozklad = new ERozklad(1, 5, 928);
// const parsedTable = await rozklad.getDayOfThisMonth(12);
// console.dir(parsedTable)