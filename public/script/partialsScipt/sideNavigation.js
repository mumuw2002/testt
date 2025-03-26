document.addEventListener('DOMContentLoaded', () => {
    const body = document.querySelector("body");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("overlay");
    const arrowBtn = document.getElementById("arrow-btn");
  
    // ฟังก์ชันเปิด/ปิด Sidebar
    const toggleSidebar = () => {
        sidebar.classList.toggle("close");
        overlay.classList.toggle("show", !sidebar.classList.contains("close"));
    };
  
    // ตรวจสอบการมีอยู่ของ element ก่อนเพิ่ม event listener
    if (arrowBtn) {
        arrowBtn.addEventListener("click", toggleSidebar);
    } else {
        console.warn("Arrow button (#arrow-btn) not found in DOM.");
    }
  
    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar.classList.add("close");
            overlay.classList.remove("show");
        });
    } else {
        console.warn("Overlay element (#overlay) not found in DOM.");
    }
  
    // ฟังก์ชันเพื่อเพิ่ม class 'active' ให้กับเมนูที่ตรงกับ path ปัจจุบัน
    const setActiveMenuItem = () => {
        const menuItems = document.querySelectorAll(".nav-links");
        const currentPath = window.location.pathname;
  
        menuItems.forEach(item => {
            const link = item.querySelector("a");
            const href = link ? link.getAttribute("href") : null;
  
            item.classList.remove("active");
  
            if (href && (href === currentPath || (currentPath.startsWith("/SystemAnnouncements") && href === "/SystemAnnouncements"))) {
                item.classList.add("active");
            }
        });
    };
  
    setActiveMenuItem();
    window.addEventListener('popstate', setActiveMenuItem);
  });