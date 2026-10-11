import residentialImage from '../ServicesImages/ResidentialCleaning.jpg';
import commercialImage from '../ServicesImages/CommercialCleaning.jpg';
import moveImage from '../ServicesImages/MoveInOutCleaning.jpg';
import deepCleanImage from '../ServicesImages/DeepCleaning.jpg';
import maintenanceImage from '../ServicesImages/MaintenanceCleaning.jpg';
import customImage from '../ServicesImages/CustomCleaning.jpg';
import specialOfferImage from '../ServicesImages/SpecialOffers.jpg';

// SCRUM-201: Descriptions appear on the back of the flip cards (Home and Services pages)
export const SERVICES_LIST = [
    {
        name: "Residential Cleaning",
        img: residentialImage,
        description: "Routine cleaning for living spaces, bedrooms, kitchens, and bathrooms with dependable attention to detail.",
    },
    {
        name: "Commercial Cleaning",
        img: commercialImage,
        description: "Professional upkeep for offices and shared spaces to maintain a clean, welcoming atmosphere.",
    },
    {
        name: "Move-in / Move-Out",
        img: moveImage,
        description: "A top-to-bottom clean of empty homes and units, so you can move in fresh or hand over the keys with confidence.",
    },
    {
        name: "Deep Cleaning",
        img: deepCleanImage,
        description: "A thorough clean that reaches the buildup routine cleaning misses, from baseboards and fixtures to hard-to-reach corners.",
    },
    {
        name: "Recurring Maintenance",
        img: maintenanceImage,
        description: "Scheduled visits that keep your space consistently clean, on a routine that works for you.",
    },
    {
        name: "Custom Requests",
        img: customImage,
        description: "Have something specific in mind? Tell us what you need and we'll tailor a cleaning plan around it.",
    },
    {
        name: "Special Offers",
        img: specialOfferImage,
        description: "Flexible cleaning bundles and seasonal promos designed to fit your schedule and budget.",
    },
];